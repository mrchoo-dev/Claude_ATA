import { useState } from 'react';
import { checkAdminPassword, setAdminAuthed } from '../lib/auth';

export default function PasswordModal({ onSuccess, onCancel, title = '관리자 인증' }) {
  const [pw, setPw] = useState('');
  const [error, setError] = useState('');

  function handleSubmit(e) {
    e.preventDefault();
    if (checkAdminPassword(pw)) {
      setAdminAuthed();
      setError('');
      onSuccess();
    } else {
      setError('비밀번호가 틀렸습니다');
      setPw('');
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)' }}
      onClick={onCancel}>
      <div className="card p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <h3 className="font-bold mb-1">🔒 {title}</h3>
        <p className="text-xs mb-4" style={{ color: 'var(--text-dim)' }}>
          관리자 비밀번호를 입력해주세요
        </p>
        <form onSubmit={handleSubmit}>
          <input
            type="password"
            autoFocus
            value={pw}
            onChange={e => setPw(e.target.value)}
            placeholder="비밀번호"
            className="w-full px-3 py-2 rounded-lg text-sm mb-3"
            style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)' }}
          />
          {error && <p className="text-xs mb-3" style={{ color: 'var(--red)' }}>{error}</p>}
          <div className="flex gap-2">
            <button type="submit"
              className="flex-1 py-2 rounded-lg text-sm font-bold text-white"
              style={{ background: 'var(--accent-lg)' }}>
              확인
            </button>
            <button type="button" onClick={onCancel}
              className="flex-1 py-2 rounded-lg text-sm"
              style={{ background: 'var(--border)', color: 'var(--text)' }}>
              취소
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
