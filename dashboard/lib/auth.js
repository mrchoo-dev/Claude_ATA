// 관리자 비밀번호 (간단한 클라이언트 사이드 보호용)
export const ADMIN_PASSWORD = 'mr.choo94';

export function checkAdminPassword(input) {
  return input === ADMIN_PASSWORD;
}

// 세션스토리지에 인증 상태 저장 (브라우저 닫으면 풀림)
export function isAdminAuthed() {
  if (typeof window === 'undefined') return false;
  return sessionStorage.getItem('ata_admin_authed') === 'true';
}

export function setAdminAuthed() {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem('ata_admin_authed', 'true');
}

export function clearAdminAuthed() {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem('ata_admin_authed');
}
