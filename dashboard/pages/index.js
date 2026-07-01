import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { isAdminAuthed } from '../lib/auth';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine
} from 'recharts';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import PasswordModal from '../components/PasswordModal';

const CHANNELS = {
  coupang: { label: '쿠팡', color: '#e8431a' },
  gmarket: { label: 'G마켓', color: '#f5a623' },
  himart: { label: '하이마트', color: '#0066cc' }
};
const CHANNEL_KEYS = Object.keys(CHANNELS);

export default function Dashboard() {
  const [categories, setCategories] = useState([]);
  const [groups, setGroups] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);

  const [showPwModal, setShowPwModal] = useState(false);
  const [pwAction, setPwAction] = useState(null);
  const [crawling, setCrawling] = useState(false);
  const [crawlMsg, setCrawlMsg] = useState('');

  useEffect(() => { fetchData(); }, []);

  async function fetchData() {
    setLoading(true);

    const { data: cats } = await supabase
      .from('categories').select('*').order('display_order');
    setCategories(cats || []);
    if (cats && cats.length > 0) {
      setSelectedCategory(prev => prev || cats[0].id);
    }

    const { data: groupsData } = await supabase
      .from('product_groups')
      .select('*, categories(name), channel_models(*)')
      .eq('is_active', true);

    const since = new Date();
    since.setDate(since.getDate() - 60);
    const { data: history } = await supabase
      .from('price_history')
      .select('*')
      .gte('crawled_at', since.toISOString())
      .order('crawled_at', { ascending: true });

    const historyByChannelModel = {};
    (history || []).forEach(h => {
      if (!historyByChannelModel[h.channel_model_id]) historyByChannelModel[h.channel_model_id] = [];
      historyByChannelModel[h.channel_model_id].push(h);
    });

    const enriched = (groupsData || []).map(g => {
      const channelData = {};
      (g.channel_models || []).forEach(cm => {
        const hist = historyByChannelModel[cm.id] || [];
        const latest = hist.length > 0 ? hist[hist.length - 1] : null;
        channelData[cm.channel] = { ...cm, history: hist, latestPrice: latest?.price || null };
      });
      return { ...g, channelData };
    });

    setGroups(enriched);

    if (history && history.length > 0) {
      setLastUpdated(new Date(history[history.length - 1].crawled_at));
    }

    if (enriched.length > 0) {
      setSelectedGroup(prev => prev || enriched[0].id);
    }

    setLoading(false);
  }

  useEffect(() => {
    if (!selectedGroup) { setChartData([]); return; }
    const group = groups.find(g => g.id === selectedGroup);
    if (!group) { setChartData([]); return; }

    const dateMap = {};
    CHANNEL_KEYS.forEach(ch => {
      const cd = group.channelData[ch];
      if (!cd) return;
      cd.history.forEach(row => {
        const date = format(new Date(row.crawled_at), 'MM/dd HH시', { locale: ko });
        if (!dateMap[date]) dateMap[date] = { date };
        dateMap[date][ch] = Math.round(row.price / 10000);
      });
    });
    setChartData(Object.values(dateMap));
  }, [selectedGroup, groups]);

  function requestAction(action) {
    if (isAdminAuthed()) {
      if (action === 'crawl') runCrawl();
      else window.location.href = '/admin';
      return;
    }
    setPwAction(action);
    setShowPwModal(true);
  }

  function handlePwSuccess() {
    setShowPwModal(false);
    if (pwAction === 'crawl') runCrawl();
    else if (pwAction === 'admin') window.location.href = '/admin';
  }

  async function runCrawl() {
    setCrawling(true);
    setCrawlMsg('크롤링 실행 중... (1~2분 소요)');
    try {
      const res = await fetch('/api/crawl', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setCrawlMsg(`✅ 완료! ${data.count}건 수집`);
        fetchData();
      } else {
        setCrawlMsg(`❌ 실패: ${data.error}`);
      }
    } catch (err) {
      setCrawlMsg(`❌ 오류: ${err.message}`);
    }
    setCrawling(false);
    setTimeout(() => setCrawlMsg(''), 5000);
  }

  const filteredGroups = groups.filter(g => g.category_id === selectedCategory);
  const selectedGroupData = groups.find(g => g.id === selectedGroup);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4">⏳</div>
          <p style={{ color: 'var(--text-dim)' }}>데이터 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-6 max-w-7xl mx-auto">
      {showPwModal && (
        <PasswordModal
          title={pwAction === 'crawl' ? '크롤러 실행' : '모델 관리'}
          onSuccess={handlePwSuccess}
          onCancel={() => setShowPwModal(false)}
        />
      )}

      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">📊 ATA 가격 모니터링</h1>
          {lastUpdated && (
            <p className="text-sm mt-1" style={{ color: 'var(--text-dim)' }}>
              마지막 업데이트: {format(lastUpdated, 'yyyy.MM.dd HH:mm', { locale: ko })}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => requestAction('crawl')}
            disabled={crawling}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white"
            style={{ background: 'var(--accent-lg)', opacity: crawling ? 0.6 : 1 }}
          >
            {crawling ? '⏳ 실행 중...' : '▶ 지금 크롤링'}
          </button>
          <button
            onClick={() => requestAction('admin')}
            className="px-4 py-2 rounded-lg text-sm font-medium"
            style={{ background: 'var(--border)', color: 'var(--text)' }}>
            ⚙️ 모델 관리
          </button>
        </div>
      </div>

      {crawlMsg && <div className="card p-3 mb-4 text-sm">{crawlMsg}</div>}

      <div className="flex gap-2 mb-6 overflow-x-auto">
        {categories.map(cat => (
          <button
            key={cat.id}
            onClick={() => { setSelectedCategory(cat.id); setSelectedGroup(null); }}
            className="px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all"
            style={{
              background: selectedCategory === cat.id ? 'var(--accent-lg)' : 'var(--surface)',
              color: selectedCategory === cat.id ? 'white' : 'var(--text-dim)',
              border: `1px solid ${selectedCategory === cat.id ? 'var(--accent-lg)' : 'var(--border)'}`
            }}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {filteredGroups.length === 0 ? (
        <div className="card p-8 text-center mb-6">
          <p style={{ color: 'var(--text-dim)' }}>이 카테고리에 등록된 모델이 없습니다.</p>
          <button onClick={() => requestAction('admin')}
            className="mt-3 text-sm underline" style={{ color: 'var(--accent-lg)' }}>
            모델 추가하기 →
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {filteredGroups.map(group => {
            const isSelected = selectedGroup === group.id;
            const brandColor = group.brand === 'LG' ? 'var(--accent-lg)' : 'var(--accent-ss)';

            return (
              <button
                key={group.id}
                onClick={() => setSelectedGroup(group.id)}
                className="card p-4 text-left transition-all"
                style={{
                  borderColor: isSelected ? brandColor : 'var(--border)',
                  boxShadow: isSelected ? `0 0 0 2px ${brandColor}33` : 'none'
                }}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="px-2 py-0.5 rounded text-xs font-bold text-white"
                    style={{ background: brandColor }}>
                    {group.brand === 'SS' ? '삼성' : 'LG'}
                  </span>
                  {group.ata_price && (
                    <span className="text-xs" style={{ color: 'var(--text-dim)' }}>
                      ATA {group.ata_price}만원
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {CHANNEL_KEYS.map(key => {
                    const ch = CHANNELS[key];
                    const cd = group.channelData[key];
                    const price = cd?.latestPrice; // 원단위
                    const priceMan = price ? Math.round(price / 10000) : null;
                    const diff = priceMan const diff = price && group.ata_price ? price - group.ata_price : null;const diff = price && group.ata_price ? price - group.ata_price : null; group.ata_price ? priceMan - group.ata_price : null;
                    return (
                      <div key={key} className="rounded-lg p-2 text-center"
                        style={{ background: 'rgba(255,255,255,0.04)' }}>
                        <div className="text-xs mb-1" style={{ color: ch.color }}>{ch.label}</div>
                        {cd?.model_name && (
                          <div className="text-[10px] font-mono mb-1 truncate" style={{ color: 'var(--text-dim)' }}>
                            {cd.model_name}
                          </div>
                        )}
                        {price ? (
                          <>
                            <div className="text-sm font-bold">{priceMan}만</div>
                            {diff !== null && (
                              <div className="text-xs" style={{ color: diff > 0 ? 'var(--red)' : 'var(--green)' }}>
                                {diff > 0 ? '+' : ''}{diff}만
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="text-xs" style={{ color: 'var(--text-dim)' }}>-</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {selectedGroupData && chartData.length > 0 && (
        <div className="card p-4 md:p-6">
          <h2 className="font-bold mb-1">
            📈 {selectedGroupData.categories?.name} · {selectedGroupData.brand === 'SS' ? '삼성' : 'LG'} 가격 추이
          </h2>
          <p className="text-xs mb-4" style={{ color: 'var(--text-dim)' }}>최근 60일</p>

          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="date" tick={{ fill: 'var(--text-dim)', fontSize: 11 }} />
              <YAxis tick={{ fill: 'var(--text-dim)', fontSize: 11 }} tickFormatter={v => `${v}만`} domain={['auto', 'auto']} />
              <Tooltip
                contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8 }}
                formatter={(value, name) => [`${value}만원`, CHANNELS[name]?.label || name]}
              />
              <Legend formatter={name => CHANNELS[name]?.label || name} />
              {selectedGroupData.ata_price && (
                <ReferenceLine
                  y={selectedGroupData.ata_price}
                  stroke="var(--text-dim)"
                  strokeDasharray="4 4"
                  label={{ value: `ATA ${selectedGroupData.ata_price}만`, fill: 'var(--text-dim)', fontSize: 11 }}
                />
              )}
              {CHANNEL_KEYS.map(key => (
                <Line key={key} type="monotone" dataKey={key} stroke={CHANNELS[key].color}
                  strokeWidth={2} dot={{ fill: CHANNELS[key].color, r: 3 }} connectNulls />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {selectedGroupData && chartData.length === 0 && (
        <div className="card p-8 text-center">
          <p style={{ color: 'var(--text-dim)' }}>
            아직 수집된 가격 데이터가 없습니다.<br />
            상단 "지금 크롤링" 버튼을 눌러 데이터를 수집해보세요.
          </p>
        </div>
      )}
    </div>
  );
}
