const dotColors = {
  online: '#4ADE80',
  away: '#FBBF24',
  offline: '#555',
};

export default function Avatar({ initials = '?', color = '#8A6EFF', size = 44, online }) {
  return (
    <div
      style={{
        position: 'relative',
        width: size,
        height: size,
        minWidth: size,
        borderRadius: '50%',
        background: color,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: size * 0.4,
        fontWeight: 600,
        color: '#fff',
        textTransform: 'uppercase',
        userSelect: 'none',
      }}
    >
      {initials}
      {online && (
        <span
          style={{
            position: 'absolute',
            bottom: 0,
            right: 0,
            width: size * 0.3,
            height: size * 0.3,
            borderRadius: '50%',
            background: dotColors[online] || dotColors.offline,
            border: `2px solid #0B0B10`,
          }}
        />
      )}
    </div>
  );
}
