const news = [
  { title: "Market Clean-up Drive", date: "Mar 15, 2026", content: "General cleaning scheduled for all sections this Saturday. All vendors are expected to participate." },
  { title: "New Payment Policy", date: "Mar 10, 2026", content: "Staggered payment option is now available for all vendors starting April 2026." },
  { title: "Holiday Schedule", date: "Mar 5, 2026", content: "The Municipal Treasurer's Office will be closed on March 28-30 for Holy Week." },
  { title: "Vendor Assembly", date: "Feb 20, 2026", content: "MARVA General Assembly on February 28. All vendors are encouraged to attend." },
];

const VendorNews = () => (
  <div className="space-y-6">
    <div>
      <h1 className="text-2xl font-bold text-foreground">News & Updates</h1>
      <p className="text-sm text-muted-foreground">Announcements from the Municipal Treasurer's Office</p>
    </div>
    <div className="space-y-4">
      {news.map((n, i) => (
        <div key={i} className="rounded-2xl border bg-card p-5 shadow-civic">
          <div className="flex items-start justify-between">
            <h3 className="font-semibold text-foreground">{n.title}</h3>
            <span className="text-xs text-muted-foreground">{n.date}</span>
          </div>
          <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{n.content}</p>
        </div>
      ))}
    </div>
  </div>
);

export default VendorNews;
