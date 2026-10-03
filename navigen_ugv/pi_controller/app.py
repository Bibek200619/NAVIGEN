#!/usr/bin/env python3
"""Run from the checkout: python3 navigen_ugv/pi_controller/app.py --mock."""
import argparse
import hmac
from http.server import BaseHTTPRequestHandler,ThreadingHTTPServer
import json
import os
from pathlib import Path
import secrets
import signal
import sys
import threading
import time

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'ros2_ws'/'src'/'navigen_hardware'))
sys.path.insert(0,str(ROOT))
from pi_controller.controller import Controller
from pi_controller.camera import Camera
from pi_controller.imu import Imu


def load_or_create_token(path):
    if path is None:
        return secrets.token_urlsafe(24)
    path=Path(path)
    path.parent.mkdir(mode=0o700,parents=True,exist_ok=True)
    try:
        fd=os.open(path,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
    except FileExistsError:
        if path.stat().st_mode & 0o077:
            raise ValueError(f'Session token file is accessible to other users: {path}')
        token=path.read_text().strip()
        if len(token)<24:
            raise ValueError(f'Session token file is invalid: {path}')
        return token
    token=secrets.token_urlsafe(24)
    with os.fdopen(fd,'w') as output:
        output.write(token+'\n')
    return token


class Server(ThreadingHTTPServer):
    daemon_threads=True
    allow_reuse_address=True

    def __init__(self,address,controller,camera,token,imu=None,imu_disabled=False):
        self.controller,self.camera,self.token,self.imu=controller,camera,token,imu
        self.imu_disabled=imu_disabled
        super().__init__(address,Handler)


class Handler(BaseHTTPRequestHandler):
    def log_message(self,format,*args):
        pass # Never log authentication material or camera URLs.

    def reply(self,status,body,content_type='application/json'):
        if not isinstance(body,bytes):
            body=json.dumps(body,allow_nan=False).encode()
        self.send_response(status)
        self.send_header('Content-Type',content_type)
        self.send_header('Content-Length',str(len(body)))
        self.send_header('Cache-Control','no-store')
        self.send_header('X-Content-Type-Options','nosniff')
        self.send_header('X-Frame-Options','DENY')
        self.end_headers()
        self.wfile.write(body)

    def authorized(self):
        expected='Bearer '+self.server.token
        return hmac.compare_digest(self.headers.get('Authorization',''),expected)

    def do_GET(self):
        if self.path in ('/','/app.js','/style.css'):
            name={'/':'index.html','/app.js':'app.js','/style.css':'style.css'}[self.path]
            content={'/':'text/html; charset=utf-8','/app.js':'text/javascript','/style.css':'text/css'}[self.path]
            return self.reply(200,(Path(__file__).parent/'static'/name).read_bytes(),content)
        if not self.authorized():
            return self.reply(401,{'error':'Enter the session token printed on the Pi'})
        if self.path == '/api/status':
            status=self.server.controller.status()
            status['camera_error']=self.server.camera.error
            status['imu']=({'available':False,'sample':None,'error':'Disabled'}
                           if self.server.imu_disabled else
                           self.server.imu.status() if self.server.imu else
                           self.server.controller.imu_status())
            return self.reply(200,status)
        if self.path == '/api/camera.jpg':
            frame=self.server.camera.latest()
            if frame is None:
                return self.reply(503,{'error':'Camera unavailable'})
            return self.reply(200,frame,'image/jpeg')
        self.reply(404,{'error':'Not found'})

    def do_POST(self):
        if not self.authorized():
            return self.reply(401,{'error':'Unauthorized'})
        try:
            length=int(self.headers.get('Content-Length','0'))
            if not 0 < length <= 1024:
                raise ValueError('Invalid request length')
            self.connection.settimeout(1.0)
            body=json.loads(self.rfile.read(length))
            if not isinstance(body,dict):
                raise ValueError('Expected JSON object')
            c=self.server.controller
            if self.path == '/api/command':
                c.command_velocity(body['linear'],body['angular'])
            elif self.path == '/api/estop':
                if body.get('active') is True:
                    c.engage()
                elif body.get('active') is False:
                    c.release()
                else:
                    raise ValueError('active must be true or false')
            elif self.path == '/api/buzzer':
                c.configure_buzzer(body['enabled'],body['threshold_cm'])
            else:
                return self.reply(404,{'error':'Not found'})
            self.reply(200,{'ok':True})
        except (ValueError,KeyError,TypeError,TimeoutError) as error:
            if self.path in ('/api/command','/api/estop'):
                self.server.controller.engage()
            self.reply(400,{'error':str(error)})


def run_loop(controller,stop_event):
    try:
        while not stop_event.is_set():
            controller.step()
            stop_event.wait(0.02)
    finally:
        controller.close()


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port',default='/dev/ttyUSB0',help='ESP8266 USB serial path')
    parser.add_argument('--http-port',type=int,default=8080)
    parser.add_argument('--bind',default='127.0.0.1',help='Use SSH forwarding for remote access')
    parser.add_argument('--track-width',type=float,default=0.34,help='Measured effective track width in metres')
    parser.add_argument('--mock',action='store_true',help='Explicit camera and motor simulation; no physical outputs')
    parser.add_argument('--no-imu',action='store_true',help='Hide MPU readings in the dashboard')
    parser.add_argument('--imu-on-pi',action='store_true',help='Read MPU from Pi I2C instead of ESP8266 telemetry')
    parser.add_argument('--imu-bus',type=int,default=1,help='MPU-6050 I2C bus number')
    parser.add_argument('--imu-address',type=lambda value:int(value,0),default=0x68,
                        help='MPU-6050 I2C address: 0x68 or 0x69')
    parser.add_argument('--token-file',help='Persist the dashboard login token across restarts')
    args=parser.parse_args()
    controller=Controller(args.port,args.mock,args.track_width)
    camera=Camera(controller,args.mock)
    imu=Imu(args.imu_bus,args.imu_address) if args.imu_on_pi and not args.mock and not args.no_imu else None
    token=load_or_create_token(args.token_file)
    server=Server((args.bind,args.http_port),controller,camera,token,imu,args.no_imu)
    stop_event=threading.Event()
    control_thread=threading.Thread(target=run_loop,args=(controller,stop_event),daemon=True)
    camera_thread=threading.Thread(target=camera.run,args=(stop_event,),daemon=True)
    imu_thread=(threading.Thread(target=imu.run,args=(stop_event,),daemon=True)
                if imu else None)
    control_thread.start();camera_thread.start()
    if imu_thread:imu_thread.start()
    print(f'NAVIGEN {"MOCK" if args.mock else "ESP8266"}: http://{args.bind}:{args.http_port}',flush=True)
    print(f'Session token: {token}',flush=True)
    print('Startup e-stop engaged. No wheel odometry; rear sensor protects reverse/turns.',flush=True)
    def shutdown(*_):
        controller.engage()
        stop_event.set()
        threading.Thread(target=server.shutdown,daemon=True).start()
    signal.signal(signal.SIGTERM,shutdown)
    signal.signal(signal.SIGINT,shutdown)
    try:
        server.serve_forever(poll_interval=0.1)
    finally:
        stop_event.set()
        control_thread.join(timeout=2)
        camera_thread.join(timeout=2)
        if imu_thread:imu_thread.join(timeout=2)
        controller.close()
        server.server_close()


if __name__ == '__main__':
    main()
