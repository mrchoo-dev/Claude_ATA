import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { isAdminAuthed, clearAdminAuthed } from '../lib/auth';
import Link from 'next/link';
import PasswordModal from '../components/PasswordModal';

const CHANNELS = ['coupang', 'gmarket', 'himart'];
const CHANNEL_LABELS = { coupang: '쿠팡', gmarket: 'G마켓', himart: '하이마트' };
const BRANDS = [{ value: 'LG', label: 'LG' }, { value: 'SS', label: '삼성' }];

export default function Admin() {
  const [authed, setAuthed] = useState(false);
  const [checkedAuth, setCheckedAuth] = useState(false);

  const [categories, setCategories] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');

  const [form, setForm] = useState({
    category_id: '',
    brand: 'LG',
    ata_price: '',
    channels: { coupang: '', gmarket: '', himart: '' },
    urls: { coupang: '', gmarket: '', himart: '' }
  });

  useEffect(() => {
    setAuthed(isAdminAuthed());
    setCheckedAuth(true);
  }, []);

  useEffect(() => {
    if (authed) fetchData();
  }, [authed]);

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }

  async function fetchData() {
    setLoading(true);
    const { data: cats } = await supabase.from('categories').select('*').order('display_order');
    const { data: grps } = await supabase
      .from('product_groups')
      .select('*, categories(name), channel_models(*)')
      .order('created_at', { ascending: false });

    setCategories(cats || []);
    setGroups(grps || []);
    if (cats && cats.length > 0) setForm(f => ({ ...f, category_id: f.category_id || cats[0].id }));
    setLoading(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const hasAnyModel = CHANNELS.some(ch => form.channels[ch].trim());
    if (!hasAnyModel) return showToast('❌ 최소 1개 채널의 모델명을 입력해주세요');
    setSaving(true);

    const { data: newGroup, error } = await supabase
      .from('product_groups')
      .insert({
        category_id: form.category_id,
        brand: form.brand,
        ata_price: form.ata_price ? parseInt(form.ata_price) : null
      })
      .select()
      .single();

    if (error) {
      showToast('❌ 저장 실패: ' + error.message);
      setSaving(false);
      return;
    }

    const channelRows = CHANNELS
      .filter(ch => form.channels[ch].trim())
      .map(ch => ({
        group_id: newGroup.id,
        channel: ch,
        model_name: form.channels[ch].trim().toUpperCase(),
        search_url: form.urls[ch].trim() || null
      }));

    if (channelRows.length > 0) {
      await supabase.from('channel_models').insert(channelRows);
    }

    showToast('✅ 모델이 추가되었습니다!');
    setShowForm(false);
    setForm({
      category_id: categories[0]?.id || '',
      brand: 'LG',
      ata_price: '',
      channels: { coupang: '', gmarket: '', himart: '' },
      urls: { coupang: '', gmarket: '', himart: '' }
    });
    fetchData();
    setSaving(false);
  }

  async function toggleActive(group) {
    await supabase.from('product_groups').update({ is_active: !group.is_active }).eq('id', group.id);
    fetchData();
  }

  async function deleteGroup(group) {
    if (!confirm(`${group.categories?.name} · ${group.brand === 'SS' ? '삼성' : 'LG'} 모델을 삭제할까요?`)) return;
    await supabase.from('product_groups').delete().eq('id', group.id);
    showToast('🗑️ 삭제되었습니다');
    fetchData();
  }

  function handleLogout() {
    clearAdminAuthed();
    setAuthed(false);
  }

  if (!checkedAuth) return null;

  if (!authed) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <PasswordModal
          title="모델 관리 페이지"
          onSuccess={() => setAuthed(true)}
          onCancel={() => { window.location.href = '/'; }}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-6 max-w-5xl mx-auto">
      {toast && (
        <div className="fixed top-4 right-4 z-50 px-4 py-3 rounded-lg text-sm font-medium"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          {toast}
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold">⚙️ 모델 관리</h1>
          <Link href="/" className="text-sm underline mt-1 block" style={{ color: 'var(--text-dim)' }}>
            ← 대시보드로
          </Link>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowForm(!showForm)}
            className="px-4 py-2 rounded-lg text-sm font-bold text-white"
            style={{ background: 'var(--accent-lg)' }}>
            + 모델 추가
          </button>
          <button onClick={handleLogout}
            className="px-3 py-2 rounded-lg text-xs"
            style={{ background: 'var(--border)', color: 'var(--text-dim)' }}>
            로그아웃
          </button>
        </div>
      </div>

      {showForm && (
        <div className="card p-5 mb-6">
          <h2 className="font-bold mb-4">새 모델 그룹 등록</h2>
          <p className="text-xs mb-4" style={{ color: 'var(--text-dim)' }}>
            하나의 그룹(카테고리+브랜드)에 채널별로 다른 모델명을 등록할 수 있어요.
          </p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs mb-1 block" style={{ color: 'var(--text-dim)' }}>카테고리</label>
                <select
                  value={form.category_id}
                  onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg text-sm"
                  style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)' }}
                >
                  {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs mb-1 block" style={{ color: 'var(--text-dim)' }}>브랜드</label>
                <div className="flex gap-2">
                  {BRANDS.map(b => (
                    <button type="button" key={b.value}
                      onClick={() => setForm(f => ({ ...f, brand: b.value }))}
                      className="flex-1 py-2 rounded-lg text-sm font-bold transition-all"
                      style={{
                        background: form.brand === b.value
                          ? (b.value === 'LG' ? 'var(--accent-lg)' : 'var(--accent-ss)')
                          : 'var(--bg)',
                        border: `1px solid var(--border)`,
                        color: form.brand === b.value ? 'white' : 'var(--text-dim)'
                      }}>
                      {b.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <label className="text-xs mb-1 block" style={{ color: 'var(--text-dim)' }}>ATA 기준가 (만원)</label>
              <input
                type="number"
                placeholder="예: 278"
                value={form.ata_price}
                onChange={e => setForm(f => ({ ...f, ata_price: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg text-sm"
                style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)' }}
              />
            </div>

            <div>
              <label className="text-xs mb-2 block" style={{ color: 'var(--text-dim)' }}>
                채널별 모델명 (해당 채널에 없으면 비워두세요)
              </label>
              {CHANNELS.map(ch => (
                <div key={ch} className="flex items-center gap-2 mb-2">
                  <span className="text-xs w-16 shrink-0 text-center py-2 rounded"
                    style={{ background: 'var(--border)' }}>
                    {CHANNEL_LABELS[ch]}
                  </span>
                  <input
                    type="text"
                    placeholder="모델명 (예: W2420WHNR)"
                    value={form.channels[ch]}
                    onChange={e => setForm(f => ({ ...f, channels: { ...f.channels, [ch]: e.target.value } }))}
                    className="flex-1 px-3 py-2 rounded-lg text-xs font-mono"
                    style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)' }}
                  />
                  <input
                    type="url"
                    placeholder="상품 URL (선택)"
                    value={form.urls[ch]}
                    onChange={e => setForm(f => ({ ...f, urls: { ...f.urls, [ch]: e.target.value } }))}
                    className="flex-1 px-3 py-2 rounded-lg text-xs"
                    style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)' }}
                  />
                </div>
              ))}
            </div>

            <div className="flex gap-3 pt-2">
              <button type="submit" disabled={saving}
                className="px-5 py-2 rounded-lg text-sm font-bold text-white"
                style={{ background: 'var(--accent-lg)', opacity: saving ? 0.6 : 1 }}>
                {saving ? '저장 중...' : '저장'}
              </button>
              <button type="button" onClick={() => setShowForm(false)}
                className="px-5 py-2 rounded-lg text-sm"
                style={{ background: 'var(--border)', color: 'var(--text)' }}>
                취소
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <p style={{ color: 'var(--text-dim)' }}>불러오는 중...</p>
      ) : groups.length === 0 ? (
        <div className="card p-8 text-center">
          <p style={{ color: 'var(--text-dim)' }}>등록된 모델이 없습니다. 위에서 추가해주세요.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {groups.map(group => (
            <div key={group.id} className="card p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-xs font-bold text-white"
                    style={{ background: group.brand === 'LG' ? 'var(--accent-lg)' : 'var(--accent-ss)' }}>
                    {group.brand === 'SS' ? '삼성' : 'LG'}
                  </span>
                  <span className="text-sm font-medium">{group.categories?.name}</span>
                  {group.ata_price && (
                    <span className="text-xs" style={{ color: 'var(--text-dim)' }}>
                      ATA {group.ata_price}만원
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => toggleActive(group)}
                    className="text-xs px-3 py-1 rounded-full"
                    style={{
                      background: group.is_active ? 'rgba(34,197,94,0.15)' : 'var(--border)',
                      color: group.is_active ? 'var(--green)' : 'var(--text-dim)',
                      border: `1px solid ${group.is_active ? 'var(--green)' : 'var(--border)'}`
                    }}>
                    {group.is_active ? '활성' : '비활성'}
                  </button>
                  <button onClick={() => deleteGroup(group)}
                    className="text-xs px-3 py-1 rounded-full"
                    style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--red)', border: '1px solid var(--red)' }}>
                    삭제
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {CHANNELS.map(ch => {
                  const cm = group.channel_models?.find(c => c.channel === ch);
                  return (
                    <div key={ch} className="rounded-lg p-2 text-center"
                      style={{ background: cm ? 'rgba(34,197,94,0.08)' : 'rgba(255,255,255,0.03)' }}>
                      <div className="text-xs mb-0.5" style={{ color: 'var(--text-dim)' }}>{CHANNEL_LABELS[ch]}</div>
                      <div className="text-xs font-mono">{cm?.model_name || '-'}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
