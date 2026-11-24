"""Чтение фрагментов Базис-Мебельщика (.fr3d, контейнер BZ85): дерево объектов и сетки TriData."""
import numpy as np
import struct, zlib, re
def keytable(o,p):
    n=struct.unpack('<I',o[p:p+4])[0]; p+=8; ks=[]
    for _ in range(n):
        l=struct.unpack('<I',o[p:p+4])[0]; ks.append(o[p+4:p+4+l].decode('latin1')); p+=4+l
    return ks,p
def parse(o,p,keys):
    ki,nc,t=struct.unpack('<IIB',o[p:p+9]); p+=9
    key=keys[0 if ki==0xFFFFFFFF else ki] if (ki==0xFFFFFFFF or ki<len(keys)) else '?%d'%ki
    v=None
    if t==1: v=False
    elif t==2: v=True
    elif t==3: v=o[p]; p+=1
    elif t==4: v=struct.unpack('<i',o[p:p+4])[0]; p+=4
    elif t==5: v=struct.unpack('<d',o[p:p+8])[0]; p+=8
    elif t==6:
        n=struct.unpack('<I',o[p:p+4])[0]; v=o[p+4:p+4+2*n].decode('utf-16le','replace'); p+=4+2*n
    elif t==7:
        n=struct.unpack('<I',o[p:p+4])[0]; v=o[p+4:p+4+n]; p+=4+n
    elif t in (8,9): v=struct.unpack('<q',o[p:p+8])[0]; p+=8
    elif t!=0: raise ValueError('type %d at %d'%(t,p))
    ch=[]
    for _ in range(nc):
        c,p=parse(o,p,keys); ch.append(c)
    return (key,v,ch),p
def load(path):
    d=open(path,'rb').read()
    assert d[:4]==b'BZ85',d[:8]
    hk,p=keytable(d,9)
    zs=[m.start() for m in re.finditer(rb'\x78[\x01\x9c\xda]',d)]
    body=None
    for z in zs:
        try:
            o=zlib.decompressobj().decompress(d[z:])
            if len(o)>200 and (body is None or len(o)>len(body)): body=o
        except Exception: pass
    return d,hk,body

def tree(path):
    import sys; sys.setrecursionlimit(100000)
    d,hk,body=load(path)
    n=struct.unpack('<I',body[:4])[0]; p=8; ks=['']
    for _ in range(n-1):
        l=struct.unpack('<I',body[p:p+4])[0]; ks.append(body[p+4:p+4+l].decode('latin1')); p+=4+l
    t,q=parse(body,p,ks)
    return t
def get(t,key):
    for c in t[2]:
        if c[0]==key: return c
def val(t,key,default=None):
    c=get(t,key); return c[1] if c else default
def tridata(b):
    """-> list of (material name, tris[n,3,3] float32, normals[n,3,3])"""
    p=0; nm=struct.unpack('<I',b[:4])[0]; p=4; out=[]
    for _ in range(nm):
        sl=struct.unpack('<I',b[p:p+4])[0]; p+=4
        name=b[p:p+2*sl].decode('utf-16le'); p+=2*sl
        p+=128
        p+=1
        n=struct.unpack('<I',b[p:p+4])[0]; p+=4
        rec=np.frombuffer(b[p:p+112*n],dtype='<f4').reshape(n,28); p+=112*n
        out.append((name.split('\r')[0],rec[:,:9].reshape(n,3,3).copy(),rec[:,9:18].reshape(n,3,3).copy()))
    assert p==len(b),(p,len(b),nm)
    return out
def quat(q):
    x,y,z,w=q
    return np.array([[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w)],[2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w)],[2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)]])
def trans(node):
    t=get(node,'Trans')
    if not t: return np.eye(3),np.zeros(3)
    v={c[0]:c[1] for c in t[2]}
    return quat((v.get('Rx',0),v.get('Ry',0),v.get('Rz',0),v.get('Rw',1))),np.array([v.get('X',0),v.get('Y',0),v.get('Z',0)])
def meshes(path):
    """плоский список: dict(path=[имена], mat, tris(world), normals(world))"""
    t=tree(path); out=[]
    def rec(node,R,T,names):
        r,tt=trans(node); R2=R@r; T2=R@tt+T
        nm=val(node,'Name'); names2=names+([nm] if nm else [])
        td=val(node,'TriData')
        if td is not None:
            for mat,tri,nor in tridata(td):
                out.append(dict(path=names2,mat=val(node,'Mat') or mat,tris=tri@R2.T+T2,nor=nor@R2.T,id=val(node,'ID')))
        objs=get(node,'Objs')
        if objs:
            for c in objs[2]: rec(c,R2,T2,names2)
    model=get(t,'Model')
    for c in model[2]: rec(c,np.eye(3),np.zeros(3),[])
    return out
def components(tris,tol=1e-3):
    """связные компоненты по совпадающим вершинам -> метки треугольников"""
    n=len(tris); v=np.round(tris.reshape(-1,3)/tol).astype(np.int64)
    _,inv=np.unique(v,axis=0,return_inverse=True); inv=inv.reshape(n,3)
    parent=np.arange(inv.max()+1)
    def f(a):
        while parent[a]!=a: parent[a]=parent[parent[a]]; a=parent[a]
        return a
    for a,b,c in inv:
        ra,rb,rc=f(a),f(b),f(c); parent[rb]=ra; parent[f(c)]=ra
    lab=np.array([f(a) for a in inv[:,0]]); _,lab=np.unique(lab,return_inverse=True)
    return lab

