import Simulator from "../../components/Simulator";
import SiteNav from "../../components/SiteNav";

export default function SimulatorPage() {
  return (
    <div className="landing vgrid sim-page">
      <SiteNav />
      <main className="wrap">
        <div className="sim-heading">
          <h1>Simulator</h1>
          <p>Pick an algorithm, fire requests, and watch the mechanism react in real time.</p>
        </div>
        <Simulator />
      </main>
    </div>
  );
}
