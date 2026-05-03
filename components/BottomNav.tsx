'use client';
import { usePathname, useRouter } from 'next/navigation';

const NAV = [
  { href:'/dashboard', icon:'⊞', label:'Dashboard' },
  { href:'/children',  icon:'👶', label:'Children' },
  { href:'/screen',    icon:'📷', label:'Screen', primary:true },
  { href:'/history',   icon:'📋', label:'History' },
  { href:'/profile',   icon:'👤', label:'Profile' },
];

export default function BottomNav() {
  const pathname = usePathname();
  const router   = useRouter();

  // Hide on /screen — camera needs full screen with no obstructions
  if (pathname.startsWith('/screen')) return null;

  return (
    <nav className="bottom-nav">
      <div style={{ display:'flex', width:'100%', justifyContent:'space-around', alignItems:'flex-start', paddingTop:4 }}>
        {NAV.map(item => {
          const active = pathname.startsWith(item.href);
          if (item.primary) return (
            <button key={item.href} onClick={() => router.push(item.href)}
              style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:2, background:'none', border:'none', cursor:'pointer', padding:'0 4px', minWidth:56, marginTop:-20 }}>
              <div style={{ width:52, height:52, borderRadius:16, background: active ? 'var(--forest-dark)' : 'var(--forest)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, boxShadow:'0 4px 12px rgba(15,76,53,0.4)' }}>
                {item.icon}
              </div>
              <span style={{ fontSize:10, fontWeight:600, color:'var(--forest)' }}>{item.label}</span>
            </button>
          );
          return (
            <button key={item.href} onClick={() => router.push(item.href)}
              style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:2, background:'none', border:'none', cursor:'pointer', padding:'4px', minWidth:56, opacity: active ? 1 : 0.45 }}>
              <span style={{ fontSize:20 }}>{item.icon}</span>
              <span style={{ fontSize:10, fontWeight: active ? 700 : 500, color: active ? 'var(--forest)' : 'var(--stone-600)' }}>{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}