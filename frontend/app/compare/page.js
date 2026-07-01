import Compare from "../../components/Compare";
import SiteNav from "../../components/SiteNav";

export const metadata = {
  title: "Compare — Rate Limiter",
  description: "Fire the same traffic at all five rate-limiting algorithms at once and compare how each one shapes it.",
};

export default function ComparePage() {
  return (
    <div className="landing vgrid sim-page">
      <SiteNav />
      <main className="wrap">
        <div className="sim-heading">
          <h1>Compare</h1>
          <p>Same traffic, five algorithms, side by side.</p>
        </div>
        <Compare />
      </main>
    </div>
  );
}
