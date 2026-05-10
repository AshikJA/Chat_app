export default function Root({ children }) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        width: '100%',
        height: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        background: '#0B0B10',
        color: '#F0F0F5',
        overflow: 'hidden',
        maxWidth: 480,
        margin: '0 auto',
        boxShadow: '0 0 80px rgba(0,0,0,.8)',
      }}
    >
      {children}
    </div>
  );
}
