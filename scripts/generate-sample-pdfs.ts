/**
 * Generate multi-page well-structured demo PDFs across several fields.
 * Output: braynr-app/public/pdfs/{anatomy,physics,costituzione,calculus,chemistry}.pdf
 *
 * Each PDF is a textbook-style chapter with realistic content packed with
 * concepts that map naturally to one of Braynr Visualizer's render modes:
 *   - 3d        → anatomy organs, molecules, architectural elements
 *   - 2d-anim   → physics simulations (inclined plane, pendulum, projectile)
 *   - 2d-text   → legal citations, articles, sources
 *   - formula   → math equations with step-by-step derivations
 *   - graph     → functions, distributions, time series
 */

import PDFDocument from "pdfkit";
import fs from "node:fs";
import path from "node:path";

const OUT = path.resolve(__dirname, "..", "public", "pdfs");
fs.mkdirSync(OUT, { recursive: true });

type Section = {
  heading: string;
  paragraphs: string[];
};

type DocSpec = {
  filename: string;
  title: string;
  subtitle: string;
  author: string;
  sections: Section[];
};

const docs: DocSpec[] = [
  // ─────────────────────────────────────────────────────────────────────
  {
    filename: "anatomy.pdf",
    title: "Human Anatomy & Physiology",
    subtitle: "Chapter 4 — The Cardiovascular and Endocrine Systems",
    author: "Braynr Open Textbook Project",
    sections: [
      {
        heading: "4.1  The Heart and Systemic Circulation",
        paragraphs: [
          "The heart is a muscular organ roughly the size of a closed fist, located in the mediastinum between the lungs and slightly left of the body's midline. It is enclosed by a tough fibroserous sac called the pericardium and divided internally into four chambers: the right atrium, the right ventricle, the left atrium, and the left ventricle. The right side of the heart receives deoxygenated blood from the systemic circulation and propels it toward the pulmonary circuit, while the left side returns oxygenated blood to the rest of the body.",
          "Blood flow through the heart is unidirectional, enforced by four valves. The tricuspid valve separates the right atrium and right ventricle, and the bicuspid (mitral) valve performs the analogous role on the left. Two semilunar valves — the pulmonary and aortic valves — guard the exits to the pulmonary trunk and aorta respectively. The cardiac cycle alternates between systole, the contractile phase, and diastole, the relaxation phase, producing the familiar 'lub-dub' sound when the valves close.",
          "The conduction of the heartbeat originates in the sinoatrial (SA) node, often called the natural pacemaker, located in the wall of the right atrium. The depolarization wave then reaches the atrioventricular (AV) node, traverses the bundle of His, and propagates through the Purkinje fibers, triggering ventricular contraction. The aorta then carries oxygen-rich blood through major branches such as the brachiocephalic, left common carotid, and left subclavian arteries.",
        ],
      },
      {
        heading: "4.2  The Pancreas and Endocrine Regulation of Glucose",
        paragraphs: [
          "The pancreas is an elongated gland positioned retroperitoneally behind the stomach, with both exocrine and endocrine functions. Embedded within the pancreatic parenchyma are the islets of Langerhans, clusters of endocrine cells that secrete several hormones critical to metabolic homeostasis. Alpha cells produce glucagon, which raises blood glucose; beta cells produce insulin, which lowers it; delta cells secrete somatostatin, which suppresses both.",
          "When circulating glucose rises after a meal, beta cells respond by releasing insulin into the portal vein, where it travels first to the liver. Insulin promotes the uptake of glucose into hepatocytes and skeletal muscle fibers, where it is converted to glycogen for storage. Conversely, during fasting the alpha cells secrete glucagon, which stimulates hepatic glycogenolysis and gluconeogenesis, releasing glucose back into the blood.",
          "The kidney also participates in homeostasis by filtering blood within nephrons and reabsorbing virtually all filtered glucose under normal conditions. When the renal tubular maximum is exceeded, glucose appears in the urine — a clinical sign of diabetes mellitus. Persistent hyperglycemia damages microvascular beds throughout the retina, kidneys, and peripheral nerves, leading to long-term complications.",
        ],
      },
      {
        heading: "4.3  The Brain and Neural Control of Visceral Function",
        paragraphs: [
          "Autonomic regulation of the heart, pancreas, and other visceral organs is coordinated by nuclei in the brainstem, especially the medulla oblongata, with overarching modulation from the hypothalamus. The hypothalamus integrates signals from circulating hormones, blood osmolarity, and core temperature, and projects to both the autonomic nervous system and the pituitary gland.",
          "The pituitary gland sits in the sella turcica of the sphenoid bone, beneath the optic chiasm. Its anterior lobe synthesizes hormones such as growth hormone, ACTH, and TSH; the posterior lobe stores and releases oxytocin and antidiuretic hormone produced by hypothalamic neurons. Together, these axes make the brain–pituitary–target-gland triad the master regulator of endocrine output.",
          "Damage to brainstem nuclei involved in cardiovascular reflexes, such as the nucleus tractus solitarius, abolishes baroreceptor responses and causes catastrophic blood pressure dysregulation. Likewise, lesions in the hypothalamic arcuate nucleus disrupt energy-balance circuits, producing hyperphagia or anorexia depending on the neuron population affected.",
        ],
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────
  {
    filename: "physics.pdf",
    title: "Classical Mechanics",
    subtitle: "Chapter 6 — Forces, Energy, and Oscillations",
    author: "Braynr Open Textbook Project",
    sections: [
      {
        heading: "6.1  The Inclined Plane",
        paragraphs: [
          "Consider a block of mass m resting on a frictionless inclined plane that makes an angle theta with the horizontal. The gravitational force mg acts vertically downward and can be decomposed into two orthogonal components: one parallel to the surface, equal to mg sin(theta), and one perpendicular to the surface, equal to mg cos(theta). The perpendicular component is balanced by the normal reaction force N exerted by the plane.",
          "The unbalanced parallel component accelerates the block down the slope according to Newton's second law: a = g sin(theta). When kinetic friction is present, with coefficient mu, the net acceleration becomes a = g (sin(theta) - mu cos(theta)). This expression yields a critical angle theta_c = arctan(mu) below which the block remains stationary, illustrating how the limiting case of static equilibrium emerges from the dynamic equations.",
          "The energy perspective offers an equivalent description. As the block descends a vertical height h, gravitational potential energy mgh is converted into kinetic energy (1/2) m v^2. On a frictionless slope, conservation of mechanical energy gives v = sqrt(2 g h), independent of the angle of inclination. Friction would dissipate part of that energy as heat, reducing the final speed accordingly.",
        ],
      },
      {
        heading: "6.2  The Simple Pendulum and Harmonic Motion",
        paragraphs: [
          "A simple pendulum consists of a point mass suspended from a fixed pivot by a massless string of length L. When displaced by a small angular amplitude theta_0, the restoring component of gravity, equal to -mg sin(theta), is approximately linear in the angle, and the bob undergoes simple harmonic motion. The angular frequency of oscillation is omega = sqrt(g/L), giving a period T = 2 pi sqrt(L/g) that depends only on length and local gravity.",
          "The motion can be described by the differential equation d^2 theta / dt^2 + (g/L) sin(theta) = 0. For small angles the equation linearizes to d^2 theta / dt^2 + (g/L) theta = 0, whose solution is theta(t) = theta_0 cos(omega t + phi). Plotting the angular position over time produces a sinusoid; plotting velocity against position produces an elliptical phase-space trajectory.",
          "Damping introduces a velocity-proportional term and the amplitude decays exponentially as exp(-gamma t). Driven by an external periodic force, the system exhibits resonance at omega = omega_0, where the steady-state amplitude grows dramatically. This phenomenon underlies the design of seismometers, the tuning of musical instruments, and the catastrophic collapse of the Tacoma Narrows bridge in 1940.",
        ],
      },
      {
        heading: "6.3  Projectile Motion",
        paragraphs: [
          "A projectile launched with initial speed v_0 at an angle alpha above the horizontal, in the absence of air resistance, follows a parabolic trajectory. Decomposing the velocity into horizontal and vertical components yields v_x = v_0 cos(alpha), constant in time, and v_y(t) = v_0 sin(alpha) - g t. Integrating gives x(t) = v_0 cos(alpha) t and y(t) = v_0 sin(alpha) t - (1/2) g t^2.",
          "The range R, time of flight T, and maximum height H follow directly: R = v_0^2 sin(2 alpha) / g, T = 2 v_0 sin(alpha) / g, and H = v_0^2 sin^2(alpha) / (2 g). The range is maximized at alpha = 45 degrees on level ground; it decreases symmetrically on either side. Plotting R as a function of alpha for a fixed v_0 produces a sinusoidal curve peaking at the optimal angle.",
          "Real projectiles are subject to drag, which depends nonlinearly on speed. At low Reynolds numbers the drag force scales linearly with velocity, while at high speeds it scales as v^2. The resulting trajectories are no longer parabolic — they become asymmetric, with shortened range and a reduced impact angle compared with the ideal case.",
        ],
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────
  {
    filename: "costituzione.pdf",
    title: "La Costituzione della Repubblica Italiana",
    subtitle: "Estratti commentati — Principi fondamentali e diritti civili",
    author: "Braynr Edizioni Giuridiche",
    sections: [
      {
        heading: "Articolo 1 — Forma della Repubblica",
        paragraphs: [
          "L'Italia è una Repubblica democratica, fondata sul lavoro. La sovranità appartiene al popolo, che la esercita nelle forme e nei limiti della Costituzione. Il riferimento al lavoro come elemento fondante esprime il rifiuto di gerarchie ereditarie e l'aspirazione a una società in cui la dignità della persona si realizzi attraverso l'attività produttiva, intellettuale o di cura.",
          "L'articolo 1 si lega indissolubilmente all'articolo 3, che riconosce pari dignità sociale e uguaglianza davanti alla legge a tutti i cittadini, senza distinzione di sesso, razza, lingua, religione, opinioni politiche, condizioni personali e sociali. Tale principio di uguaglianza, formale e sostanziale, è stato ripetutamente richiamato dalla Corte costituzionale, ad esempio nella sentenza n. 1/2014 in tema di legge elettorale.",
        ],
      },
      {
        heading: "Articolo 11 — Ripudio della guerra",
        paragraphs: [
          "L'Italia ripudia la guerra come strumento di offesa alla libertà degli altri popoli e come mezzo di risoluzione delle controversie internazionali; consente, in condizioni di parità con gli altri Stati, alle limitazioni di sovranità necessarie ad un ordinamento che assicuri la pace e la giustizia fra le Nazioni; promuove e favorisce le organizzazioni internazionali rivolte a tale scopo.",
          "La seconda parte dell'articolo costituisce la base costituzionale della partecipazione italiana all'Unione europea e alle Nazioni Unite. La giurisprudenza della Corte costituzionale, in particolare la sentenza n. 170/1984 (Granital), ha riconosciuto la prevalenza del diritto comunitario direttamente applicabile sulle norme interne contrastanti, fondandosi proprio sull'articolo 11 letto in combinato disposto con l'articolo 117.",
        ],
      },
      {
        heading: "Articolo 21 — Libertà di manifestazione del pensiero",
        paragraphs: [
          "Tutti hanno diritto di manifestare liberamente il proprio pensiero con la parola, lo scritto e ogni altro mezzo di diffusione. La stampa non può essere soggetta ad autorizzazioni o censure. Si può procedere a sequestro soltanto per atto motivato dell'autorità giudiziaria nel caso di delitti, per i quali la legge sulla stampa espressamente lo autorizzi.",
          "Il quinto comma vieta le pubblicazioni a stampa, gli spettacoli e tutte le altre manifestazioni contrarie al buon costume. La legge stabilisce provvedimenti adeguati a prevenire e a reprimere le violazioni. La Corte costituzionale ha precisato il bilanciamento con altri diritti — onore, riservatezza, sicurezza pubblica — nelle sentenze n. 86/1974 e n. 138/1985.",
        ],
      },
      {
        heading: "Articolo 32 — Tutela della salute",
        paragraphs: [
          "La Repubblica tutela la salute come fondamentale diritto dell'individuo e interesse della collettività, e garantisce cure gratuite agli indigenti. Nessuno può essere obbligato a un determinato trattamento sanitario se non per disposizione di legge. La legge non può in nessun caso violare i limiti imposti dal rispetto della persona umana.",
          "L'articolo è stato richiamato dalla Corte nella sentenza n. 5/2018 sull'obbligo vaccinale e nella ben nota sentenza n. 242/2019 sul fine vita. Il bilanciamento tra autodeterminazione individuale e tutela della collettività rappresenta una delle questioni più delicate della giurisprudenza costituzionale recente.",
        ],
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────
  {
    filename: "calculus.pdf",
    title: "Differential and Integral Calculus",
    subtitle: "Chapter 3 — Derivatives, Integrals, and Series",
    author: "Braynr Open Textbook Project",
    sections: [
      {
        heading: "3.1  The Derivative as a Limit",
        paragraphs: [
          "Given a function f defined on an open interval containing a point x, the derivative f'(x) is defined as the limit of the difference quotient: f'(x) = lim_{h->0} [f(x+h) - f(x)] / h, provided this limit exists. Geometrically, the derivative represents the slope of the tangent line to the graph of f at the point (x, f(x)).",
          "From the definition one can derive the power rule, d/dx [x^n] = n x^(n-1), as well as the rules for sums, products, and quotients. The chain rule, d/dx [f(g(x))] = f'(g(x)) g'(x), allows us to differentiate compositions. Applying these rules, one finds for example that d/dx [sin(x)] = cos(x) and d/dx [exp(x)] = exp(x), with the latter being the unique non-trivial function that equals its own derivative.",
          "The function f(x) = x^2 has derivative f'(x) = 2x, vanishing at the origin. Its graph is a parabola with vertex at (0,0) opening upward; the tangent at any point (a, a^2) has equation y = 2 a x - a^2. Plotting the family of tangents traces out the parabola itself as their envelope.",
        ],
      },
      {
        heading: "3.2  The Definite Integral and the Fundamental Theorem",
        paragraphs: [
          "The definite integral of a continuous function f over an interval [a, b] is defined as the limit of Riemann sums: integral_a^b f(x) dx = lim_{n->inf} sum_{k=1}^n f(x_k) Delta x. Geometrically, this represents the signed area between the graph of f and the x-axis over [a, b].",
          "The Fundamental Theorem of Calculus links differentiation and integration. Part I states that if F(x) = integral_a^x f(t) dt, then F'(x) = f(x). Part II states that integral_a^b f(x) dx = F(b) - F(a), where F is any antiderivative of f. Together they reduce many integrals to algebraic computations.",
          "Consider the area under the standard normal density phi(x) = (1/sqrt(2 pi)) exp(-x^2/2). Its integral over the entire real line equals 1, but no elementary antiderivative exists; the cumulative distribution function Phi(x) must be evaluated numerically. Plotting phi(x) yields the iconic bell curve centered at zero with inflection points at x = +/-1.",
        ],
      },
      {
        heading: "3.3  Taylor Series and Approximation",
        paragraphs: [
          "If f is infinitely differentiable at a point a, its Taylor series around a is f(x) = sum_{n=0}^inf [f^(n)(a) / n!] (x - a)^n. When this series converges to f(x) on a neighborhood of a, the function is called analytic. The Maclaurin series, the special case a = 0, gives the familiar expansions exp(x) = sum x^n / n!, sin(x) = sum (-1)^n x^(2n+1) / (2n+1)!, and cos(x) = sum (-1)^n x^(2n) / (2n)!.",
          "Truncating the series at degree N produces a polynomial approximation whose error is governed by the Lagrange remainder R_N(x) = f^(N+1)(c) (x - a)^(N+1) / (N+1)! for some c between a and x. As N grows, the polynomial graph hugs f more and more tightly within the radius of convergence, while diverging outside it.",
          "Plotting the partial sums of the Maclaurin series for sin(x) reveals an instructive pattern: each successive odd-degree polynomial closely tracks sin(x) over an ever-widening interval before peeling away. This visual demonstrates both the local accuracy of Taylor approximation and the inherent limitation of any finite truncation.",
        ],
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────
  {
    filename: "chemistry.pdf",
    title: "Organic Chemistry",
    subtitle: "Chapter 2 — Hydrocarbons, Functional Groups, and Geometry",
    author: "Braynr Open Textbook Project",
    sections: [
      {
        heading: "2.1  Methane and Tetrahedral Geometry",
        paragraphs: [
          "Methane (CH4) is the simplest hydrocarbon and the prototypical example of sp3 hybridization. The carbon atom forms four equivalent sigma bonds to hydrogen atoms arranged at the vertices of a regular tetrahedron, with H–C–H bond angles of approximately 109.5 degrees and C–H bond lengths near 109 picometers. This geometry minimizes electron-pair repulsion in accordance with VSEPR theory.",
          "Methane is the principal component of natural gas and a potent greenhouse gas, with a global warming potential roughly 28 times that of carbon dioxide over a century. Its combustion follows the equation CH4 + 2 O2 → CO2 + 2 H2O, releasing approximately 890 kJ per mole. Visualizing the three-dimensional tetrahedral arrangement is essential to understanding why methane is non-polar despite the polarity of individual C–H bonds.",
        ],
      },
      {
        heading: "2.2  The Water Molecule and Hydrogen Bonding",
        paragraphs: [
          "Water (H2O) consists of an oxygen atom bonded to two hydrogen atoms with an H–O–H bond angle of about 104.5 degrees, slightly less than the ideal tetrahedral angle because of repulsion from the two lone pairs on oxygen. The molecule is bent and strongly polar, with a dipole moment of 1.85 debye pointing from the hydrogens toward the oxygen.",
          "Each water molecule can participate in up to four hydrogen bonds — two as donor through its hydrogens, two as acceptor through the oxygen lone pairs. This network underlies water's remarkable properties: high boiling point, high specific heat, surface tension, and the lower density of ice relative to liquid water. Visualization of the lattice of hydrogen-bonded water molecules in ice reveals a hexagonal open structure that explains why ice floats.",
        ],
      },
      {
        heading: "2.3  Benzene and Aromaticity",
        paragraphs: [
          "Benzene (C6H6) is a planar six-membered ring of carbon atoms, each bonded to a single hydrogen. The C–C bond lengths are all 139 picometers — intermediate between a single bond (154 pm) and a double bond (134 pm) — reflecting the delocalization of six pi electrons across the ring. This continuous pi system gives benzene its aromatic stability.",
          "Hückel's rule states that a planar, fully conjugated monocyclic system is aromatic if it contains 4n+2 pi electrons. Benzene satisfies the rule with n = 1, accounting for its enhanced stability and characteristic chemistry: it preferentially undergoes electrophilic aromatic substitution rather than addition. Visualizing the molecular orbitals — three bonding and three antibonding pi MOs distributed above and below the ring plane — clarifies why aromaticity is fundamentally a quantum-mechanical phenomenon.",
        ],
      },
    ],
  },
];

function renderDoc(spec: DocSpec) {
  const outPath = path.join(OUT, spec.filename);
  const doc = new PDFDocument({
    size: "A4",
    margins: { top: 72, bottom: 72, left: 72, right: 72 },
    info: {
      Title: spec.title,
      Author: spec.author,
      Subject: spec.subtitle,
      Producer: "Braynr Demo PDF Generator",
    },
    bufferPages: true,
    pdfVersion: "1.7",
    tagged: true,
    displayTitle: true,
    lang: "en-US",
  });
  doc.pipe(fs.createWriteStream(outPath));

  // ── Title page ───────────────────────────────────
  doc
    .font("Helvetica-Bold")
    .fontSize(28)
    .fillColor("#0f172a")
    .text(spec.title, { align: "left" });
  doc.moveDown(0.5);
  doc
    .font("Helvetica")
    .fontSize(14)
    .fillColor("#475569")
    .text(spec.subtitle, { align: "left" });
  doc.moveDown(0.6);
  doc
    .font("Helvetica-Oblique")
    .fontSize(11)
    .fillColor("#64748b")
    .text(spec.author, { align: "left" });
  doc.moveDown(1.5);
  doc
    .strokeColor("#cbd5e1")
    .lineWidth(0.7)
    .moveTo(72, doc.y)
    .lineTo(72 + 451, doc.y)
    .stroke();
  doc.moveDown(1.0);

  // ── Body ─────────────────────────────────────────
  for (const sec of spec.sections) {
    if (doc.y > 700) doc.addPage();
    doc
      .font("Helvetica-Bold")
      .fontSize(15)
      .fillColor("#0f172a")
      .text(sec.heading, { align: "left" });
    doc.moveDown(0.5);
    doc
      .font("Times-Roman")
      .fontSize(11.5)
      .fillColor("#1e293b");
    for (const p of sec.paragraphs) {
      doc.text(p, {
        align: "justify",
        paragraphGap: 8,
        lineGap: 2.5,
        indent: 18,
      });
    }
    doc.moveDown(0.8);
  }

  // ── Page numbers ─────────────────────────────────
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i);
    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor("#94a3b8")
      .text(`${spec.title}  ·  page ${i + 1} of ${range.count}`, 72, 800, {
        align: "center",
        width: 451,
        lineBreak: false,
      });
  }

  doc.end();
  console.log(`✓ ${outPath}`);
}

console.log(`Generating ${docs.length} sample PDFs into ${OUT}`);
docs.forEach(renderDoc);
