import React, { useRef, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { User, Camera } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { urlFoto } from '../utils/userPhoto';

export default function SidebarUserBlock({ user, perfilPath }) {
  const { updateUser } = useAuth();
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [erro, setErro] = useState('');

  const foto = urlFoto(user);

  const escolherFoto = () => inputRef.current?.click();

  const onFicheiro = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setErro('Seleccione uma imagem (JPG, PNG, etc.).');
      return;
    }
    setUploading(true);
    setErro('');
    const fd = new FormData();
    fd.append('foto', file);
    try {
      const res = await api.post('/auth/perfil/foto', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      updateUser({ foto_url: res.data.foto_url });
    } catch (err) {
      setErro(err.response?.data?.message || 'Erro ao carregar foto.');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  return (
    <div className="sidebar-user-block">
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        style={{ display: 'none' }}
        onChange={onFicheiro}
      />
      <button
        type="button"
        className="sidebar-avatar-btn"
        onClick={escolherFoto}
        disabled={uploading}
        title="Clique para escolher a sua fotografia"
      >
        <div className="sidebar-avatar">
          {foto ? (
            <img src={foto} alt="" />
          ) : (
            <span className="sidebar-avatar-fallback"><User size={28} /></span>
          )}
          <span className="sidebar-avatar-overlay">
            <Camera size={18} />
          </span>
        </div>
      </button>
      {uploading && (
        <p style={{ fontSize: '0.75rem', color: 'var(--laranja-claro)', margin: '4px 0' }}>A carregar...</p>
      )}
      {erro && <p style={{ fontSize: '0.75rem', color: '#ffb4b4', margin: '4px 0' }}>{erro}</p>}
      <div className="sidebar-user-name">{user?.nome || 'Utilizador'}</div>
      <NavLink to={perfilPath} className="sidebar-profile-link">
        Perfil
      </NavLink>
    </div>
  );
}
