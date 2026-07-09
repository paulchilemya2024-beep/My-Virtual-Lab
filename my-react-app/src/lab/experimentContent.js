// Hardcoded, curriculum-aligned notes + questions for every experiment. NEVER
// AI-generated. Read by NotesView (Part A) and QuestionsView (Part C); the
// simulation itself (Part B) reads `experiment.steps` from the server as before.
//
// Shape:
//   notes: { sections: [{ title, paragraphs: [string] }], keyTerms: [{ term, def }] }
//   questions: [{ type: 'mc'|'tf'|'short', prompt, options?, answer?, explanation?, modelAnswer? }]
//     mc      → options: [{ text, correct, explanation }]
//     tf      → answer: boolean, explanation: string
//     short   → modelAnswer: string (shown after submit, not graded right/wrong)

export const EXPERIMENT_CONTENT = {
  osmosis: {
    notes: {
      sections: [
        {
          title: '1. What is Osmosis?',
          paragraphs: [
            'Osmosis is the movement of water molecules through a semipermeable membrane from an area of high water concentration (low solute) to an area of low water concentration (high solute). It requires no energy — water moves passively down its own concentration gradient.',
            'A semipermeable membrane is a barrier that allows some molecules to pass through but not others. The cell membrane of every living cell is semipermeable — it allows water to pass freely but blocks most dissolved substances.',
          ],
        },
        {
          title: '2. Three Outcomes of Osmosis',
          paragraphs: [
            'When a cell is placed in a solution, one of three things happens depending on concentration.',
            'HYPOTONIC SOLUTION: the solution outside has less solute than inside the cell. Water moves INTO the cell. The cell swells. In animal cells, too much swelling causes the membrane to burst — this is called LYSIS or CYTOLYSIS.',
            'ISOTONIC SOLUTION: the concentration outside equals the concentration inside. Water moves equally in both directions. The cell stays the same size. This is why hospital IV fluids use 0.9% saline — it matches blood cell concentration exactly.',
            'HYPERTONIC SOLUTION: the solution outside has MORE solute than inside the cell. Water moves OUT of the cell. The cell shrinks. In animal cells this is called CRENATION — the cell becomes wrinkled and shrunken.',
          ],
        },
        {
          title: '3. Plant Cells vs Animal Cells',
          paragraphs: [
            'Plant cells behave differently because they have a rigid cell wall outside the membrane. In a hypotonic solution, water enters the cell but the wall prevents bursting. The cell becomes firm — this is called TURGOR PRESSURE and is what makes plants stand upright.',
            'In a hypertonic solution, the membrane shrinks away from the wall — this is called PLASMOLYSIS.',
          ],
        },
        {
          title: '4. Real Life Connections',
          paragraphs: [
            'Osmosis explains many everyday phenomena: why you feel thirsty after eating very salty food (salt draws water out of your cells); why vegetables go limp when left in salty water; how your kidneys control water in your blood; and why drinking seawater makes dehydration worse.',
          ],
        },
      ],
      keyTerms: [
        { term: 'Osmosis', def: 'The passive movement of water across a semipermeable membrane toward the higher solute concentration.' },
        { term: 'Semipermeable membrane', def: 'A barrier that lets water through freely but blocks most dissolved substances.' },
        { term: 'Hypotonic', def: 'Lower solute concentration than the cell — water moves in.' },
        { term: 'Isotonic', def: 'Equal solute concentration to the cell — no net water movement.' },
        { term: 'Hypertonic', def: 'Higher solute concentration than the cell — water moves out.' },
        { term: 'Lysis', def: 'Bursting of an animal cell membrane from too much water entering.' },
        { term: 'Crenation', def: 'Shrinking and wrinkling of an animal cell from water loss.' },
        { term: 'Turgor pressure', def: 'The pressure of the cell contents pressing outward on a firm plant cell wall.' },
        { term: 'Plasmolysis', def: "The plant cell membrane pulling away from the cell wall as water leaves." },
        { term: 'Concentration gradient', def: 'A difference in solute concentration between two regions that drives net movement.' },
      ],
    },
    questions: [
      {
        type: 'mc',
        prompt: 'A red blood cell is placed in pure distilled water. What will happen?',
        options: [
          { text: 'The cell will shrink', correct: false },
          { text: 'The cell will swell and may burst', correct: true },
          { text: 'The cell will stay the same size', correct: false },
          { text: 'The cell will produce gas', correct: false },
        ],
        explanation: 'Distilled water is hypotonic to the cell. Water enters the cell by osmosis, causing it to swell. If enough water enters, the membrane ruptures — this is called lysis.',
      },
      {
        type: 'mc',
        prompt: '0.9% saline solution is described as isotonic to blood cells. This means:',
        options: [
          { text: 'It has more salt than blood', correct: false },
          { text: 'It has less salt than blood', correct: false },
          { text: 'It has the same concentration as blood', correct: true },
          { text: 'It contains no dissolved substances', correct: false },
        ],
        explanation: 'Isotonic means equal concentration. No net water movement occurs, so cells maintain their normal shape and size.',
      },
      {
        type: 'tf',
        prompt: 'A plant cell will burst in pure water just like an animal cell.',
        answer: false,
        explanation: 'Plant cells have a rigid cell wall that prevents the cell from expanding beyond a certain point. The cell becomes turgid but does not burst.',
      },
      {
        type: 'short',
        prompt: 'In this experiment, what did you observe happening to the cell when it was placed in the 10% salt solution?',
        modelAnswer: 'The cell shrank and became wrinkled (crenated) because water moved out of the cell into the more concentrated salt solution by osmosis.',
      },
      {
        type: 'mc',
        prompt: "What is the term for the shrinking of a plant cell's membrane away from the cell wall in a hypertonic solution?",
        options: [
          { text: 'Lysis', correct: false },
          { text: 'Turgidity', correct: false },
          { text: 'Plasmolysis', correct: true },
          { text: 'Crenation', correct: false },
        ],
        explanation: 'Plasmolysis occurs specifically in plant cells when the membrane pulls away from the wall due to water loss.',
      },
      {
        type: 'mc',
        prompt: 'Why does drinking seawater make dehydration worse?',
        options: [
          { text: 'Seawater contains bacteria', correct: false },
          { text: 'Seawater is hypertonic to body cells, drawing water OUT of cells', correct: true },
          { text: 'Seawater is hypotonic to body cells', correct: false },
          { text: 'Seawater contains too much oxygen', correct: false },
        ],
        explanation: 'Seawater is far more concentrated than body fluids. Drinking it pulls water out of cells by osmosis instead of hydrating them.',
      },
    ],
  },

  'metal-acid': {
    notes: {
      sections: [
        {
          title: '1. The Reactivity Series',
          paragraphs: [
            'Metals differ in how readily they react with other substances. Scientists have arranged metals in order of reactivity — this is called the REACTIVITY SERIES. The most reactive metals are at the top; the least reactive at the bottom.',
            'Order (most to least reactive): Potassium → Sodium → Calcium → Magnesium → Aluminium → Zinc → Iron → Tin → Lead → Copper → Silver → Gold.',
          ],
        },
        {
          title: '2. Metals Reacting with Acids',
          paragraphs: [
            'When a metal reacts with a dilute acid, it produces a SALT and HYDROGEN GAS. The general equation is: Metal + Acid → Salt + Hydrogen gas.',
            'Example: Magnesium + Hydrochloric acid → Magnesium chloride + Hydrogen. Mg + 2HCl → MgCl₂ + H₂.',
            'The hydrogen gas produced causes effervescence (bubbling). The more reactive the metal, the faster and more vigorous the reaction.',
          ],
        },
        {
          title: '3. Testing for Hydrogen Gas',
          paragraphs: [
            'Hydrogen gas is tested using the BURNING SPLINT TEST: hold a lit splint near the mouth of the test tube. If hydrogen is present, you will hear a distinctive squeaky pop sound as the gas ignites.',
            'Copper does not react with dilute hydrochloric acid because copper is below hydrogen in the reactivity series. A metal can only displace hydrogen from an acid if it is more reactive than hydrogen.',
          ],
        },
        {
          title: '4. Why This Matters',
          paragraphs: [
            'The reactivity series explains why iron bridges rust but gold jewellery does not; why magnesium is used in flares and fireworks; how we choose metals for specific uses (copper for plumbing, iron for construction); and how displacement reactions power batteries.',
          ],
        },
      ],
      keyTerms: [
        { term: 'Reactivity series', def: 'An ordered list of metals from most to least reactive.' },
        { term: 'Effervescence', def: 'The bubbling seen when a gas is released from a liquid.' },
        { term: 'Displacement reaction', def: 'A reaction where a more reactive element takes the place of a less reactive one in a compound.' },
        { term: 'Salt', def: 'An ionic compound formed when a metal replaces the hydrogen of an acid.' },
        { term: 'Hydrogen gas', def: 'The colourless, flammable gas produced when a reactive metal reacts with an acid.' },
        { term: 'Exothermic', def: 'A reaction that releases heat to its surroundings.' },
        { term: 'Burning splint test', def: 'A test for hydrogen gas — a lit splint gives a squeaky pop if hydrogen is present.' },
      ],
    },
    questions: [
      {
        type: 'mc',
        prompt: 'Which metal reacted most vigorously with hydrochloric acid in this experiment?',
        options: [
          { text: 'Copper', correct: false },
          { text: 'Iron', correct: false },
          { text: 'Zinc', correct: false },
          { text: 'Magnesium', correct: true },
        ],
        explanation: 'Magnesium is highest in the reactivity series among the metals tested. More reactive metals react faster and produce more heat and gas.',
      },
      {
        type: 'mc',
        prompt: 'What gas is produced when magnesium reacts with hydrochloric acid?',
        options: [
          { text: 'Oxygen', correct: false },
          { text: 'Carbon dioxide', correct: false },
          { text: 'Hydrogen', correct: true },
          { text: 'Chlorine', correct: false },
        ],
        explanation: 'Mg + 2HCl → MgCl₂ + H₂. The hydrogen gas is responsible for the effervescence (bubbling) you observed.',
      },
      {
        type: 'tf',
        prompt: 'Copper reacted with hydrochloric acid to produce hydrogen gas.',
        answer: false,
        explanation: 'Copper is below hydrogen in the reactivity series. It cannot displace hydrogen from an acid. No reaction occurs.',
      },
      {
        type: 'short',
        prompt: 'Describe the difference in reaction speed between magnesium and iron when added to hydrochloric acid.',
        modelAnswer: 'Magnesium reacted vigorously with rapid bubbling and noticeable heat. Iron reacted very slowly with only a few bubbles and little heat change.',
      },
      {
        type: 'mc',
        prompt: 'Which test is used to confirm that hydrogen gas has been produced?',
        options: [
          { text: 'Universal indicator test', correct: false },
          { text: 'Limewater test', correct: false },
          { text: 'Burning splint test', correct: true },
          { text: 'Litmus paper test', correct: false },
        ],
        explanation: 'A lit splint held near the mouth of the test tube produces a squeaky pop if hydrogen is present as the gas ignites.',
      },
      {
        type: 'mc',
        prompt: 'Iron is used to make bridges but gold is used for jewellery. This is best explained by:',
        options: [
          { text: 'Gold is cheaper than iron', correct: false },
          { text: 'Iron is more reactive and corrodes; gold is unreactive and does not', correct: true },
          { text: 'Gold is stronger than iron', correct: false },
          { text: 'Iron conducts electricity better', correct: false },
        ],
        explanation: 'Gold sits at the very bottom of the reactivity series, so it resists corrosion — ideal for jewellery that must stay untarnished.',
      },
    ],
  },

  titration: {
    notes: {
      sections: [
        {
          title: '1. What is Neutralisation?',
          paragraphs: [
            'Neutralisation is the reaction between an acid and a base that produces a salt and water. General equation: Acid + Base → Salt + Water.',
            'When equal amounts of acid and base react completely, the resulting solution has a pH of 7 and is neutral. The process releases heat — it is an exothermic reaction.',
          ],
        },
        {
          title: '2. The pH Scale',
          paragraphs: [
            'pH measures how acidic or alkaline a solution is. The scale runs from 0 to 14: pH 0–6 is acidic (lower = more acidic), pH 7 is neutral (pure water), and pH 8–14 is alkaline/basic (higher = more alkaline).',
            'Strong acids like HCl have a pH near 1. Strong bases like NaOH have a pH near 13–14.',
          ],
        },
        {
          title: '3. Indicators',
          paragraphs: [
            'Indicators are substances that change colour depending on pH. Common indicators: phenolphthalein (colourless in acid, pink/magenta in alkali), litmus (red in acid, blue in alkali), and universal indicator (full colour range from red (acid) through green (neutral) to purple (alkali)).',
            'In a titration experiment, we add base to acid drop by drop and use an indicator to find the exact point of neutralisation — this is called the EQUIVALENCE POINT.',
          ],
        },
        {
          title: '4. Real Life Uses',
          paragraphs: [
            'Neutralisation is used everywhere: antacid tablets neutralise excess stomach acid; farmers add limestone (calcium carbonate) to neutralise acidic soil; toothpaste neutralises acids produced by bacteria in your mouth; and wastewater treatment plants neutralise industrial acid waste before releasing it.',
          ],
        },
      ],
      keyTerms: [
        { term: 'Neutralisation', def: 'The reaction of an acid with a base to form a salt and water.' },
        { term: 'Equivalence point', def: 'The point in a titration where the acid and base have exactly reacted.' },
        { term: 'pH', def: 'A scale from 0–14 measuring how acidic or alkaline a solution is.' },
        { term: 'Indicator', def: 'A substance that changes colour depending on the pH of its surroundings.' },
        { term: 'Titration', def: 'The controlled addition of one solution to another to find the equivalence point.' },
        { term: 'Exothermic', def: 'A reaction that releases heat to its surroundings.' },
        { term: 'Salt', def: 'An ionic compound formed when an acid reacts with a base.' },
        { term: 'Acid', def: 'A substance that releases H⁺ ions in solution, pH below 7.' },
        { term: 'Base', def: 'A substance that can neutralise an acid.' },
        { term: 'Alkali', def: 'A base that is soluble in water, pH above 7.' },
      ],
    },
    questions: [
      {
        type: 'mc',
        prompt: 'What is the pH at the equivalence point of a strong acid–strong base neutralisation?',
        options: [
          { text: '0', correct: false },
          { text: '5', correct: false },
          { text: '7', correct: true },
          { text: '14', correct: false },
        ],
        explanation: 'Equal moles of strong acid and strong base exactly cancel, leaving a neutral solution at pH 7.',
      },
      {
        type: 'mc',
        prompt: 'Phenolphthalein indicator is colourless in acid. What colour does it turn in an alkaline solution?',
        options: [
          { text: 'Yellow', correct: false },
          { text: 'Blue', correct: false },
          { text: 'Pink/Magenta', correct: true },
          { text: 'Green', correct: false },
        ],
        explanation: 'Phenolphthalein turns pink/magenta above about pH 8.2, which is why it is used to spot the endpoint of an acid–base titration.',
      },
      {
        type: 'short',
        prompt: 'What did you observe happening to the colour of the indicator as you added NaOH drop by drop?',
        modelAnswer: 'The solution stayed colourless/red for most of the addition, then near the equivalence point, a single drop caused a sudden colour change to pink, indicating the solution had become alkaline.',
      },
      {
        type: 'mc',
        prompt: 'A patient takes an antacid tablet for heartburn. This is an example of:',
        options: [
          { text: 'Oxidation', correct: false },
          { text: 'Neutralisation', correct: true },
          { text: 'Displacement', correct: false },
          { text: 'Decomposition', correct: false },
        ],
        explanation: 'Antacids contain a mild base that neutralises the excess stomach acid causing the heartburn.',
      },
      {
        type: 'tf',
        prompt: 'Adding more acid after the equivalence point will make the pH go higher.',
        answer: false,
        explanation: 'Adding more acid after equivalence means excess acid is present, which lowers pH, not raises it.',
      },
      {
        type: 'mc',
        prompt: 'Why do farmers add crushed limestone to soil?',
        options: [
          { text: 'To add nitrogen to the soil', correct: false },
          { text: 'To neutralise acidic soil and raise pH', correct: true },
          { text: 'To make the soil darker', correct: false },
          { text: 'To kill weeds', correct: false },
        ],
        explanation: 'Limestone (calcium carbonate) is a mild base that reacts with excess soil acid, raising the pH back toward neutral.',
      },
    ],
  },

  circuit: {
    notes: {
      sections: [
        {
          title: '1. What Makes a Circuit?',
          paragraphs: [
            'An electric circuit is a complete, unbroken loop that charge can flow around. A battery provides the push (voltage) that drives current through the loop, and a component like a bulb uses that current to do work — in this case, glow.',
            'If the loop is broken anywhere — even by a tiny gap — no current can flow, and the bulb stays dark. This is the basis of every switch.',
          ],
        },
        {
          title: '2. Conductors and Insulators',
          paragraphs: [
            'A CONDUCTOR is a material with free-moving charged particles (usually electrons) that can carry current through it. Metals are conductors because their outer electrons are not tightly bound to any one atom — they form a "sea" of free electrons that drifts under an applied voltage.',
            'An INSULATOR has no free charges — every electron is locked to its atom or molecule, so no current can flow through it. Rubber, plastic, wood and dry air are all insulators, which is why they are used to coat wires and handle tools safely.',
            'Some materials sit in between: graphite conducts, but poorly (high resistance, so the bulb glows dim), and salt water conducts because the dissolved ions — not electrons — carry the charge.',
          ],
        },
        {
          title: '3. Why This Matters',
          paragraphs: [
            'Understanding conductors and insulators is why household wiring uses copper cores wrapped in a plastic or rubber insulating sheath, why electricians wear rubber gloves, and why saltwater is dangerous around electrical equipment even though pure water barely conducts at all.',
          ],
        },
      ],
      keyTerms: [
        { term: 'Circuit', def: 'A complete loop that electric current can flow around.' },
        { term: 'Conductor', def: 'A material with free charges that lets current flow easily.' },
        { term: 'Insulator', def: 'A material with no free charges, blocking current flow.' },
        { term: 'Voltage', def: 'The electrical push (from a battery) that drives current around a circuit.' },
        { term: 'Current', def: 'The flow of electric charge through a conductor.' },
        { term: 'Resistance', def: 'How strongly a material opposes the flow of current.' },
      ],
    },
    questions: [
      {
        type: 'mc',
        prompt: 'Why does copper conduct electricity well?',
        options: [
          { text: 'It has a sea of free electrons that can drift and carry charge', correct: true },
          { text: 'It is a very hard, dense material', correct: false },
          { text: 'It is shiny and reflects light', correct: false },
          { text: 'It contains dissolved ions', correct: false },
        ],
        explanation: 'Metals like copper have loosely-bound outer electrons that form a "sea" of free charge carriers, letting current flow easily.',
      },
      {
        type: 'tf',
        prompt: 'A gap anywhere in a circuit will stop current from flowing anywhere in that circuit.',
        answer: true,
        explanation: 'A circuit is one continuous loop — a single break anywhere stops the whole loop from conducting, just like a broken chain.',
      },
      {
        type: 'mc',
        prompt: 'Why does saltwater conduct electricity but distilled water does not?',
        options: [
          { text: 'Saltwater is warmer', correct: false },
          { text: 'Dissolved salt creates free ions that carry charge through the water', correct: true },
          { text: 'Distilled water is denser', correct: false },
          { text: 'Saltwater is a metal', correct: false },
        ],
        explanation: 'Pure water has almost no free ions. Dissolving salt in it releases Na⁺ and Cl⁻ ions, which carry current through the solution.',
      },
      {
        type: 'short',
        prompt: 'Describe what happened to the bulb when you tested an insulator like rubber compared to a metal like iron.',
        modelAnswer: 'With rubber in the gap, the bulb stayed completely dark because no current could cross the insulator. With iron in the gap, the bulb lit up because iron is a metal with free electrons that complete the circuit.',
      },
      {
        type: 'mc',
        prompt: 'Why is rubber used to coat electrical wires?',
        options: [
          { text: 'It is cheap and colourful', correct: false },
          { text: 'It is an insulator that stops current from escaping the wire', correct: true },
          { text: 'It conducts electricity better than metal', correct: false },
          { text: 'It makes the wire heavier', correct: false },
        ],
        explanation: 'Rubber has no free electrons, so it safely blocks current from leaking out of the copper wire it surrounds.',
      },
    ],
  },

  indicators: {
    notes: {
      sections: [
        {
          title: '1. The pH Scale',
          paragraphs: [
            'pH is a scale from 0 to 14 that measures how acidic or alkaline a solution is. Values below 7 are acidic, 7 is neutral, and values above 7 are alkaline (basic). The further from 7, the stronger the acid or alkali.',
          ],
        },
        {
          title: '2. How Indicators Work',
          paragraphs: [
            'An indicator is a dye that changes colour depending on the concentration of H⁺ ions in a solution. Universal indicator is a mixture of several dyes, so it shows a whole rainbow across the pH scale: red at strong acid, green at neutral, and purple at strong alkali.',
            'Litmus is simpler — red in acid, purple near neutral, blue in alkali. Phenolphthalein is different again: it stays completely colourless across most of the scale and only turns bright pink above pH 8.2, which makes it excellent for spotting a very specific point rather than reading a whole range.',
          ],
        },
        {
          title: '3. Why Different Indicators Exist',
          paragraphs: [
            'No single indicator can do everything. Universal indicator is best for estimating an unknown pH at a glance. Phenolphthalein is best for detecting one precise threshold (used heavily in titrations). Choosing the right indicator for the right job is a core skill in analytical chemistry.',
          ],
        },
      ],
      keyTerms: [
        { term: 'pH', def: 'A scale from 0–14 measuring how acidic or alkaline a solution is.' },
        { term: 'Acidic', def: 'Having a pH below 7.' },
        { term: 'Alkaline', def: 'Having a pH above 7; also called basic.' },
        { term: 'Indicator', def: 'A dye that changes colour depending on pH.' },
        { term: 'Universal indicator', def: 'A mixed indicator that shows a full rainbow of colours across the pH scale.' },
        { term: 'Neutral', def: 'Having a pH of exactly 7, neither acidic nor alkaline.' },
      ],
    },
    questions: [
      {
        type: 'mc',
        prompt: 'What colour does universal indicator turn in a strong acid?',
        options: [
          { text: 'Green', correct: false },
          { text: 'Purple', correct: false },
          { text: 'Red', correct: true },
          { text: 'Blue', correct: false },
        ],
        explanation: 'Universal indicator reads red at the acidic end of the scale (roughly pH 1–3).',
      },
      {
        type: 'tf',
        prompt: 'Phenolphthalein changes colour gradually across the whole pH scale, like universal indicator.',
        answer: false,
        explanation: 'Phenolphthalein stays colourless across most of the scale and only changes sharply around pH 8.2 — a single threshold, not a gradual rainbow.',
      },
      {
        type: 'mc',
        prompt: 'A solution turns litmus paper blue. What can you conclude?',
        options: [
          { text: 'The solution is acidic', correct: false },
          { text: 'The solution is neutral', correct: false },
          { text: 'The solution is alkaline', correct: true },
          { text: 'The solution contains no water', correct: false },
        ],
        explanation: 'Litmus turns blue in alkaline (basic) conditions and red in acidic conditions.',
      },
      {
        type: 'short',
        prompt: 'Why would a scientist choose phenolphthalein instead of universal indicator for a titration?',
        modelAnswer: 'Phenolphthalein gives one sharp, easy-to-see colour change at a specific pH, making it easy to spot the exact endpoint. Universal indicator changes gradually through many colours, which makes the exact endpoint harder to pinpoint.',
      },
      {
        type: 'mc',
        prompt: 'Pure water is tested with universal indicator. What colour should appear?',
        options: [
          { text: 'Red', correct: false },
          { text: 'Green', correct: true },
          { text: 'Purple', correct: false },
          { text: 'Orange', correct: false },
        ],
        explanation: 'Pure water is neutral (pH 7), which universal indicator shows as green.',
      },
    ],
  },

  precipitation: {
    notes: {
      sections: [
        {
          title: '1. What is a Precipitate?',
          paragraphs: [
            'A precipitate is an insoluble solid that forms and separates out of a solution during a chemical reaction. Precipitation happens when two soluble solutions are mixed and their ions combine to form a new compound that will not dissolve.',
          ],
        },
        {
          title: '2. Double Displacement Reactions',
          paragraphs: [
            'A precipitation reaction is a type of DOUBLE DISPLACEMENT reaction: the positive ion of one compound swaps places with the positive ion of the other. General form: AB + CD → AD + CB, where one of the products is insoluble.',
            'Example: silver nitrate + sodium chloride → silver chloride (insoluble, white precipitate) + sodium nitrate (stays dissolved). AgNO₃ + NaCl → AgCl↓ + NaNO₃.',
          ],
        },
        {
          title: '3. Identifying Ions by Colour',
          paragraphs: [
            'Many metal hydroxides have distinctive precipitate colours: copper(II) hydroxide is pale blue, iron(III) hydroxide is red-brown, and silver chloride is white. Chemists use these colours as a simple test to identify which metal ion is present in an unknown solution.',
          ],
        },
      ],
      keyTerms: [
        { term: 'Precipitate', def: 'An insoluble solid that forms out of a solution during a reaction.' },
        { term: 'Double displacement', def: 'A reaction where the positive ions of two compounds swap partners.' },
        { term: 'Insoluble', def: 'Unable to dissolve in a solvent (here, water).' },
        { term: 'Soluble', def: 'Able to dissolve in a solvent.' },
        { term: 'Ion', def: 'A charged particle formed when an atom gains or loses electrons.' },
      ],
    },
    questions: [
      {
        type: 'mc',
        prompt: 'What colour precipitate forms when silver nitrate reacts with sodium chloride?',
        options: [
          { text: 'Blue', correct: false },
          { text: 'Red-brown', correct: false },
          { text: 'White', correct: true },
          { text: 'Yellow', correct: false },
        ],
        explanation: 'Silver chloride (AgCl) is a white, insoluble precipitate — a classic test for chloride ions.',
      },
      {
        type: 'tf',
        prompt: 'In a precipitation reaction, both products are always insoluble.',
        answer: false,
        explanation: 'Only one product is typically insoluble (the precipitate); the other product usually stays dissolved in solution.',
      },
      {
        type: 'mc',
        prompt: 'What type of reaction produces a precipitate by swapping ion partners?',
        options: [
          { text: 'Combustion', correct: false },
          { text: 'Double displacement', correct: true },
          { text: 'Neutralisation', correct: false },
          { text: 'Decomposition', correct: false },
        ],
        explanation: 'A double displacement reaction exchanges the positive ions between two compounds, and one of the new pairings is insoluble.',
      },
      {
        type: 'short',
        prompt: 'How did you use precipitate colour to identify which metal ion was present in the solution?',
        modelAnswer: 'A pale blue precipitate indicated copper ions (copper hydroxide), while a red-brown precipitate indicated iron(III) ions (iron hydroxide) — the colour acts as a simple identifying test.',
      },
      {
        type: 'mc',
        prompt: 'Why does a precipitate eventually settle to the bottom of the flask?',
        options: [
          { text: 'It reacts further with the water', correct: false },
          { text: 'It is denser than the surrounding solution and insoluble in it', correct: true },
          { text: 'It evaporates and reforms below', correct: false },
          { text: 'The solution becomes colder', correct: false },
        ],
        explanation: 'Because the solid cannot dissolve and is generally denser than the liquid, gravity pulls it down into a settled layer (sediment).',
      },
    ],
  },

  'catalysis-peroxide': {
    notes: {
      sections: [
        {
          title: '1. Decomposition of Hydrogen Peroxide',
          paragraphs: [
            'Hydrogen peroxide (H₂O₂) is naturally unstable and slowly breaks down into water and oxygen gas: 2H₂O₂ → 2H₂O + O₂. On its own, at room temperature, this happens very slowly.',
          ],
        },
        {
          title: '2. What is a Catalyst?',
          paragraphs: [
            'A CATALYST is a substance that speeds up a chemical reaction without being used up itself, and without appearing in the final products. Manganese dioxide (MnO₂) is a classic catalyst for peroxide decomposition — it provides a surface that makes the reaction happen thousands of times faster, releasing oxygen gas rapidly as a frothy foam and giving off heat.',
            'Because the catalyst is not consumed, the same small amount of manganese dioxide can keep catalysing the reaction indefinitely as more peroxide is added.',
          ],
        },
        {
          title: '3. Safety — Hazardous Combinations',
          paragraphs: [
            'Not every combination is safe. Mixing hydrogen peroxide with potassium permanganate causes an extremely violent, strongly exothermic reaction — the temperature can spike dangerously fast. This is why real laboratories keep strong oxidisers apart and follow strict handling rules.',
          ],
        },
      ],
      keyTerms: [
        { term: 'Catalyst', def: 'A substance that speeds up a reaction without being consumed by it.' },
        { term: 'Decomposition', def: 'A reaction where one compound breaks down into two or more simpler substances.' },
        { term: 'Exothermic', def: 'A reaction that releases heat.' },
        { term: 'Oxidiser', def: 'A substance that readily gives up oxygen or accepts electrons in a reaction.' },
      ],
    },
    questions: [
      {
        type: 'mc',
        prompt: 'What gas is produced when hydrogen peroxide decomposes?',
        options: [
          { text: 'Hydrogen', correct: false },
          { text: 'Carbon dioxide', correct: false },
          { text: 'Oxygen', correct: true },
          { text: 'Nitrogen', correct: false },
        ],
        explanation: '2H₂O₂ → 2H₂O + O₂ — oxygen gas is released, seen as froth/bubbles.',
      },
      {
        type: 'tf',
        prompt: 'Manganese dioxide is used up and disappears as it catalyses the peroxide decomposition.',
        answer: false,
        explanation: 'A catalyst speeds up a reaction without being consumed — the manganese dioxide remains chemically unchanged at the end.',
      },
      {
        type: 'mc',
        prompt: 'Why does adding manganese dioxide make the reaction froth up and warm quickly?',
        options: [
          { text: 'It cools the peroxide, releasing trapped gas', correct: false },
          { text: 'It catalyses much faster decomposition, releasing oxygen and heat rapidly', correct: true },
          { text: 'It reacts to form a new, hotter compound', correct: false },
          { text: 'It absorbs the peroxide completely', correct: false },
        ],
        explanation: 'The catalyst dramatically speeds up the same reaction, so oxygen and heat that would have released over hours appear in seconds.',
      },
      {
        type: 'short',
        prompt: 'What did you observe was different about mixing peroxide with potassium permanganate compared to manganese dioxide?',
        modelAnswer: 'The manganese dioxide reaction fizzed steadily with rising heat, but the potassium permanganate reaction was far more violent and dangerous, with the temperature rising very quickly — a hazardous combination.',
      },
      {
        type: 'mc',
        prompt: 'A catalyst works by:',
        options: [
          { text: 'Becoming a permanent part of the product', correct: false },
          { text: 'Being used up completely during the reaction', correct: false },
          { text: 'Providing an easier pathway for the reaction without being consumed', correct: true },
          { text: 'Cooling the reactants before they combine', correct: false },
        ],
        explanation: 'Catalysts lower the energy needed for a reaction to proceed but are chemically unchanged and reusable afterward.',
      },
    ],
  },

  projectile: {
    notes: {
      sections: [
        {
          title: '1. What is Projectile Motion?',
          paragraphs: [
            'Projectile motion is the motion of an object that is launched into the air and moves under the influence of gravity alone. Once the object leaves the launcher, no engine or force pushes it forward — only gravity acts on it, pulling it downward at 9.81 m/s² every second.',
            'Examples of projectile motion in real life: a football kicked into the air, a bullet fired from a gun, a basketball thrown toward a hoop, water from a garden hose, and a long jumper leaping from the board.',
            'The path that a projectile follows is always a PARABOLA — a symmetric curved shape.',
          ],
        },
        {
          title: '2. The Two Independent Components',
          paragraphs: [
            'The key insight in projectile motion is that the horizontal and vertical movements are completely INDEPENDENT of each other.',
            'HORIZONTAL MOTION: the horizontal velocity never changes. There is no air resistance in this experiment, so nothing slows the object sideways. Horizontal velocity = v₀ × cos(θ), and this stays constant for the entire flight.',
            'VERTICAL MOTION: gravity constantly pulls the object downward, decelerating it as it rises and accelerating it as it falls. Initial vertical velocity = v₀ × sin(θ), and this decreases by 9.81 m/s every second.',
            'This independence explains a famous fact: if you fire a bullet horizontally and simultaneously drop an identical bullet from the same height, BOTH bullets hit the ground at exactly the same time — because gravity acts equally on both regardless of horizontal motion.',
          ],
        },
        {
          title: '3. The Key Equations',
          paragraphs: [
            'Position at time t: x(t) = v₀ × cos(θ) × t, and y(t) = v₀ × sin(θ) × t − ½ × g × t².',
            'Maximum Height: H = (v₀ × sin(θ))² ÷ (2 × g). Time of Flight: T = 2 × v₀ × sin(θ) ÷ g. Horizontal Range: R = v₀² × sin(2θ) ÷ g.',
            'Where v₀ = initial speed (m/s), θ = launch angle (degrees), g = 9.81 m/s² (gravity on Earth), and t = time (seconds).',
            'The range formula reveals something important: sin(2θ) is maximum when 2θ = 90°, meaning θ = 45°. So 45° ALWAYS gives the maximum range for any given launch speed.',
          ],
        },
        {
          title: '4. Complementary Angles',
          paragraphs: [
            'Two angles that add up to 90° are called complementary angles. For example: 30° and 60°, or 20° and 70°.',
            'An interesting property of the range formula: sin(2 × 30°) = sin(60°), and sin(2 × 60°) = sin(120°) = sin(60°). They are equal.',
            'This means complementary angles always give the SAME horizontal range, even though the trajectories look very different: the smaller angle gives a flatter, faster path with lower maximum height, while the larger angle gives a higher, slower path with greater maximum height — but both land at the same horizontal distance. You will discover this pattern during the experiment.',
          ],
        },
        {
          title: '5. Real Life Applications',
          paragraphs: [
            'SPORT: athletes and coaches use projectile motion to optimise technique. The ideal shot-put angle is slightly less than 45° because the athlete releases from above ground level.',
            'MILITARY: artillery gunners calculate the exact angle and charge needed to hit a target at a known distance — pure projectile motion math.',
            'ENGINEERING: designing water fountains, irrigation systems, and drainage channels all require projectile motion calculations.',
            'SPACE: launching satellites involves projectile motion at extreme speeds — at orbital velocity, the projectile falls around Earth rather than into it.',
            'MEDICINE: surgical tools like needle injectors in robotic surgery use projectile motion principles for precise delivery.',
          ],
        },
      ],
      keyTerms: [
        { term: 'Projectile', def: 'An object launched into the air, moving under gravity alone after launch.' },
        { term: 'Trajectory', def: 'The curved path a projectile follows through the air.' },
        { term: 'Parabola', def: 'The symmetric curved shape every projectile path traces.' },
        { term: 'Range', def: 'The total horizontal distance a projectile travels before landing.' },
        { term: 'Maximum height', def: 'The greatest height reached during flight, at the midpoint of the trajectory.' },
        { term: 'Time of flight', def: 'The total time a projectile spends in the air.' },
        { term: 'Launch angle', def: 'The angle above the ground at which a projectile is launched.' },
        { term: 'Initial velocity', def: 'The speed and direction of the projectile the instant it is launched.' },
        { term: 'Horizontal component', def: 'The part of the velocity along the ground — stays constant throughout flight.' },
        { term: 'Vertical component', def: 'The part of the velocity straight up — changes constantly due to gravity.' },
        { term: 'Complementary angles', def: 'Two angles that add up to 90° — they produce equal range for the same speed.' },
        { term: 'Gravitational acceleration', def: 'The rate gravity speeds up a falling object — 9.81 m/s² on Earth.' },
      ],
    },
    questions: [
      {
        type: 'mc',
        prompt: 'At what launch angle is the horizontal range of a projectile maximum?',
        options: [
          { text: '30°', correct: false },
          { text: '60°', correct: false },
          { text: '90°', correct: false },
          { text: '45°', correct: true },
        ],
        explanation: 'The range formula is R = v₀²sin(2θ)/g. sin(2θ) is maximum when 2θ = 90°, so θ = 45°.',
      },
      {
        type: 'mc',
        prompt: 'A ball is launched at 30° and another at 60°, both with the same initial speed. What can you say about their ranges?',
        options: [
          { text: 'The 60° ball travels further', correct: false },
          { text: 'The 30° ball travels further', correct: false },
          { text: 'They travel the same horizontal range', correct: true },
          { text: 'It depends on the speed', correct: false },
        ],
        explanation: '30° and 60° are complementary angles (they add to 90°). sin(2×30°) = sin(60°) and sin(2×60°) = sin(120°) = sin(60°) — equal values, equal range.',
      },
      {
        type: 'mc',
        prompt: 'During projectile motion with no air resistance, what happens to the horizontal velocity?',
        options: [
          { text: 'It increases due to gravity', correct: false },
          { text: 'It decreases due to gravity', correct: false },
          { text: 'It stays constant throughout', correct: true },
          { text: 'It becomes zero at maximum height', correct: false },
        ],
        explanation: 'Gravity only acts vertically. Nothing acts horizontally (no air resistance), so horizontal velocity never changes.',
      },
      {
        type: 'short',
        prompt: 'In this experiment, what happened to the flight time when you switched from Earth gravity to Moon gravity (keeping the same angle and speed)?',
        modelAnswer: 'The flight time increased significantly on the Moon because the weaker gravity (1.62 m/s² vs 9.81 m/s²) means the projectile is decelerated vertically much more slowly, so it takes much longer to return to the ground.',
      },
      {
        type: 'mc',
        prompt: 'A football is kicked at 20 m/s at an angle of 35°. What is the vertical component of its initial velocity?',
        options: [
          { text: '20 m/s', correct: false },
          { text: '20 × cos(35°) = 16.4 m/s', correct: false },
          { text: '20 × sin(35°) = 11.5 m/s', correct: true },
          { text: '9.81 m/s', correct: false },
        ],
        explanation: 'Vertical component = v₀ × sin(θ) = 20 × sin(35°) = 20 × 0.574 = 11.5 m/s.',
      },
      {
        type: 'tf',
        prompt: 'A bullet fired horizontally from a gun and a bullet dropped from the same height at the same moment will hit the ground at different times.',
        answer: false,
        explanation: 'Both bullets experience the same gravitational acceleration downward (9.81 m/s²). The horizontal motion of the fired bullet does not affect how fast it falls. Both hit the ground simultaneously — this demonstrates that horizontal and vertical motion are completely independent.',
      },
    ],
  },

  incline: {
    notes: {
      sections: [
        {
          title: '1. Forces on a Slope',
          paragraphs: [
            'A block resting on an inclined plane experiences three forces: its weight (mg, straight down), the normal force (N, perpendicular to the ramp surface, pushing the block away from it), and friction (f, along the ramp surface, resisting motion).',
            'On a slope, weight splits into two useful components: one pressing INTO the ramp (mg·cosθ, balanced by the normal force) and one pulling the block DOWN the slope (mg·sinθ).',
          ],
        },
        {
          title: '2. When Does the Block Slide?',
          paragraphs: [
            'Friction can only resist up to a maximum value: f_max = μ·N, where μ (mu) is the coefficient of friction — a number describing how rough the two surfaces are together. As long as mg·sinθ ≤ μ·mg·cosθ, the block stays still.',
            'The block starts to slide the moment the down-slope pull exceeds the maximum friction available: mg·sinθ > μ·mg·cosθ, which simplifies to tanθ > μ. This critical angle is called the ANGLE OF REPOSE.',
          ],
        },
        {
          title: '3. Real Life Connections',
          paragraphs: [
            'This is why icy roads (very low μ) become dangerous on even gentle hills, why hiking boots use rubber soles with high μ for grip, and how engineers calculate the safe maximum slope for a wheelchair ramp or a loading dock.',
          ],
        },
      ],
      keyTerms: [
        { term: 'Normal force', def: 'The force a surface exerts perpendicular to itself, supporting an object resting on it.' },
        { term: 'Friction', def: 'A force resisting relative motion between two surfaces in contact.' },
        { term: 'Coefficient of friction (μ)', def: 'A number describing how much friction exists between two particular surfaces.' },
        { term: 'Angle of repose', def: 'The steepest angle at which an object can rest on a slope without sliding.' },
        { term: 'Component', def: 'One of the perpendicular parts a force can be split into.' },
      ],
    },
    questions: [
      {
        type: 'mc',
        prompt: 'A block begins to slide down a ramp. What must be true at that moment?',
        options: [
          { text: 'mg·sinθ exceeds the maximum static friction', correct: true },
          { text: 'The normal force has dropped to zero', correct: false },
          { text: 'The coefficient of friction has increased', correct: false },
          { text: 'The block has gained mass', correct: false },
        ],
        explanation: 'Sliding begins exactly when the down-slope component of weight overcomes the maximum friction force the surfaces can provide.',
      },
      {
        type: 'tf',
        prompt: 'A rougher surface (higher μ) allows a ramp to be steeper before an object slides.',
        answer: true,
        explanation: 'Since sliding begins when tanθ > μ, a larger μ requires a larger angle θ before the tangent condition is met — so rougher surfaces support steeper ramps.',
      },
      {
        type: 'mc',
        prompt: 'As the ramp angle increases, what happens to the normal force on the block?',
        options: [
          { text: 'It increases', correct: false },
          { text: 'It stays exactly the same', correct: false },
          { text: 'It decreases', correct: true },
          { text: 'It becomes negative', correct: false },
        ],
        explanation: 'The normal force equals mg·cosθ, and cosθ decreases as the angle increases, so the normal force shrinks as the ramp gets steeper.',
      },
      {
        type: 'short',
        prompt: 'How did the slipping angle change when you switched from a low-friction surface (like ice) to a high-friction surface (like rubber on concrete)?',
        modelAnswer: 'With the low-friction (ice) surface, the block began sliding at a much smaller ramp angle. With the high-friction (rubber on concrete) surface, the ramp had to be tilted much steeper before the block would slide.',
      },
      {
        type: 'mc',
        prompt: 'Why is friction unable to stop a block from sliding once tanθ > μ?',
        options: [
          { text: 'Friction disappears completely at that angle', correct: false },
          { text: "Friction is already at its maximum possible value and the down-slope force is now larger", correct: true },
          { text: 'The normal force becomes negative', correct: false },
          { text: 'Gravity stops acting on the block', correct: false },
        ],
        explanation: 'Static friction caps out at μN. Once the down-slope force exceeds that cap, there is nothing left to hold the block in place, and it accelerates down the ramp.',
      },
    ],
  },

  pendulum: {
    notes: {
      sections: [
        {
          title: '1. The Simple Pendulum Formula',
          paragraphs: [
            'A simple pendulum is a mass (the bob) swinging on a string from a fixed point. For small swing angles, the time for one full back-and-forth swing — the PERIOD — is given by T = 2π√(L/g), where L is the string length and g is the local gravitational acceleration.',
            'Notice that mass does not appear anywhere in this formula. A heavier bob and a lighter bob on the same length of string swing with exactly the same period — gravity pulls harder on the heavier bob, but it also takes proportionally more force to accelerate it, and the two effects cancel exactly.',
          ],
        },
        {
          title: '2. What Actually Changes the Period',
          paragraphs: [
            'Only two things change the period: the string length (longer string → longer period, but only by the square root of the length — doubling L increases T by √2, not by 2) and the strength of gravity (weaker gravity → longer period, since g sits in the denominator under the square root).',
          ],
        },
        {
          title: '3. Energy Conservation',
          paragraphs: [
            'As a pendulum swings, energy continuously trades between kinetic energy (motion, maximum at the lowest point) and gravitational potential energy (height, maximum at the highest points of the swing). Ignoring air resistance, the total energy stays constant throughout the motion.',
          ],
        },
      ],
      keyTerms: [
        { term: 'Period', def: 'The time taken for one complete oscillation (a full back-and-forth swing).' },
        { term: 'Oscillation', def: 'One complete repeating cycle of motion.' },
        { term: 'Amplitude', def: 'The maximum angle (or displacement) a pendulum swings from vertical.' },
        { term: 'Kinetic energy', def: 'Energy of motion.' },
        { term: 'Potential energy', def: "Stored energy due to an object's position, here due to height." },
      ],
    },
    questions: [
      {
        type: 'mc',
        prompt: "In the pendulum formula T = 2π√(L/g), which variable is NOT part of the formula?",
        options: [
          { text: 'String length', correct: false },
          { text: 'Gravitational acceleration', correct: false },
          { text: 'Bob mass', correct: true },
          { text: 'π (pi)', correct: false },
        ],
        explanation: 'Mass cancels out of the pendulum equation entirely — a heavier or lighter bob swings with exactly the same period.',
      },
      {
        type: 'tf',
        prompt: 'Doubling the string length exactly doubles the period of a pendulum.',
        answer: false,
        explanation: 'Period depends on the SQUARE ROOT of length, so doubling L only increases T by a factor of √2 ≈ 1.41, not 2.',
      },
      {
        type: 'mc',
        prompt: 'A pendulum is taken to the Moon, where gravity is weaker than on Earth. What happens to its period?',
        options: [
          { text: 'It gets shorter', correct: false },
          { text: 'It stays exactly the same', correct: false },
          { text: 'It gets longer', correct: true },
          { text: 'The pendulum stops swinging', correct: false },
        ],
        explanation: 'Since g is in the denominator inside the square root, a smaller g produces a larger T — the pendulum swings more slowly on the Moon.',
      },
      {
        type: 'short',
        prompt: 'You changed the bob mass but kept the length and gravity the same. What happened to the measured period, and why?',
        modelAnswer: "The period stayed the same even though the mass changed, because mass does not appear in the pendulum formula T = 2π√(L/g) — gravity's stronger pull on a heavier bob is exactly cancelled by the extra force needed to accelerate that same heavier bob.",
      },
      {
        type: 'mc',
        prompt: 'At the very bottom of its swing, a pendulum bob has:',
        options: [
          { text: 'Maximum potential energy, zero kinetic energy', correct: false },
          { text: 'Maximum kinetic energy, minimum potential energy', correct: true },
          { text: 'Zero total energy', correct: false },
          { text: 'Equal kinetic and potential energy', correct: false },
        ],
        explanation: 'At the lowest point the bob moves fastest (max KE) and is at its lowest height (min PE) — the classic energy-conservation trade-off.',
      },
    ],
  },
}
