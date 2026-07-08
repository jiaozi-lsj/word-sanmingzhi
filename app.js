const sections = Array.from(document.querySelectorAll('.panel'));
const navLinks = Array.from(document.querySelectorAll('.nav-links a'));
const dots = Array.from(document.querySelectorAll('.section-dots a'));

const setActiveSection = (id) => {
  for (const link of [...navLinks, ...dots]) {
    link.classList.toggle('is-active', link.getAttribute('href') === `#${id}`);
  }
};

const observer = new IntersectionObserver(
  (entries) => {
    const visible = entries
      .filter((entry) => entry.isIntersecting)
      .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
    if (visible?.target?.id) setActiveSection(visible.target.id);
  },
  { threshold: [0.48, 0.62, 0.78] }
);

for (const section of sections) observer.observe(section);

setActiveSection('home');
