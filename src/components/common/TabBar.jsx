export default function TabBar({ tabs, active, onChange }) {
  return (
    <div className="tabbar" role="tablist">
      {tabs.map(([key, label]) => (
        <button
          key={key}
          role="tab"
          aria-selected={active === key}
          className={`tab ${active === key ? "on" : ""}`}
          onClick={() => onChange(key)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
