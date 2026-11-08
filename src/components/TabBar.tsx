import { NavLink } from 'react-router-dom';
import { useInboxCount } from '../hooks';

export function TabBar() {
  const inbox = useInboxCount();
  const cls = ({ isActive }: { isActive: boolean }) => `tab ${isActive ? 'on' : ''}`;
  return (
    <nav className="tabbar">
      <div className="tabbar-in">
        <NavLink to="/" end className={cls}><span className="ic">🏠</span>Beranda</NavLink>
        <NavLink to="/inbox" className={cls}>
          <span className="ic">📥</span>Inbox
          {inbox > 0 && <span className="badge">{inbox}</span>}
        </NavLink>
        <NavLink to="/add" className="tab" aria-label="Tambah transaksi"><span className="add">+</span></NavLink>
        <NavLink to="/plans" className={cls}><span className="ic">🎯</span>Rencana</NavLink>
        <NavLink to="/reports" className={cls}><span className="ic">📊</span>Laporan</NavLink>
      </div>
    </nav>
  );
}
