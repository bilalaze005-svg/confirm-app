export default function NotificationBell({ unreadCount, onClick }) {
  return (
    <button onClick={onClick} aria-label="الإشعارات"
      style={{ position: 'relative', width: 38, height: 38, borderRadius: '50%', border: 'none', background: 'rgba(255,255,255,.16)', color: 'white', fontSize: 17, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      🔔
      {unreadCount > 0 && (
        <span style={{ position: 'absolute', top: -2, left: -2, background: '#DC2626', color: 'white', borderRadius: '50%', minWidth: 18, height: 18, padding: '0 3px', fontSize: 10, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #7C3AED' }}>
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
    </button>
  )
}
