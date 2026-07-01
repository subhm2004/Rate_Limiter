import Simulator from "../../components/Simulator";
import SiteNav from "../../components/SiteNav";

export default function SimulatorPage() {
  return (
    <div className="landing vgrid sim-page">
      <SiteNav />
      <main className="wrap">
        <div className="sim-heading">
          <h1>Simulator</h1>
        </div>
        <Simulator />
      </main>
    </div>
  );
}
