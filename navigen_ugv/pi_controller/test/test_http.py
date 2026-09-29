import json
import threading
from urllib.request import Request,urlopen
from urllib.error import HTTPError
import pytest
from pi_controller.app import Server,load_or_create_token
from pi_controller.controller import Controller


class Camera:
    error='test'
    def latest(self):
        return None


def test_http_auth_validation_and_static_files():
    c=Controller(mock=True)
    server=Server(('127.0.0.1',0),c,Camera(),'test-token')
    thread=threading.Thread(target=server.serve_forever,daemon=True)
    thread.start()
    base=f'http://127.0.0.1:{server.server_port}'
    def request(path,body=None,auth=True):
        headers={'Authorization':'Bearer test-token'} if auth else {}
        data=json.dumps(body).encode() if body is not None else None
        return urlopen(Request(base+path,data=data,headers=headers),timeout=2)
    try:
        page=request('/',auth=False).read()
        assert b'UGV control' in page
        assert b'Rear distance' in page and b'Buzzer threshold' in page
        with pytest.raises(HTTPError) as error:
            request('/api/status',auth=False)
        assert error.value.code == 401
        assert json.load(request('/api/status'))['estop'] is True
        assert json.load(request('/api/buzzer',{'enabled':True,'threshold_cm':30}))['ok']
        assert c.buzzer_enabled and c.buzzer_threshold_mm == 300
        with pytest.raises(HTTPError) as error:
            request('/api/buzzer',{'enabled':'yes','threshold_cm':30})
        assert error.value.code == 400 and c.buzzer_enabled
        with pytest.raises(HTTPError) as error:
            request('/api/command',{'linear':'bad','angular':0})
        assert error.value.code == 400 and c.estop
        with pytest.raises(HTTPError) as error:
            request('/api/camera.jpg')
        assert error.value.code == 503
        assert json.load(request('/api/estop',{'active':True}))['ok']
        with pytest.raises(HTTPError):
            request('/../../README.md')
    finally:
        server.shutdown();server.server_close();thread.join(2);c.close()


def test_dashboard_token_persists_with_private_permissions(tmp_path):
    path=tmp_path/'private'/'dashboard.token'
    token=load_or_create_token(path)
    assert len(token)>=24
    assert load_or_create_token(path)==token
    assert path.stat().st_mode & 0o077 == 0
