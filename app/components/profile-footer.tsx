import { FaAngleRight } from "react-icons/fa6";

export function ProfileFooter() {
  return (
    <footer className="profile-footer mt-24">
      <div>
        <p className="terminal-label">whoami</p>
        <h2>Daisuke Kobayashi</h2>
        <p>
          Tlazolteotnia is a personal space for artwork, experiments, and short
          notes. For current visual work, visit ArtStation.
        </p>
      </div>

      <nav aria-label="Profile links">
        <a href="https://twitter.com/0rga">
          <FaAngleRight aria-hidden="true" />
          X / Twitter
        </a>
        <a href="https://www.artstation.com/orga">
          <FaAngleRight aria-hidden="true" />
          ArtStation
        </a>
      </nav>
    </footer>
  );
}
