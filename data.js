/* Pousse : données du plan alimentaire. À adapter librement. */
(function (root) {
  const MOMENTS = [
    { id: 'pdj',  label: 'Petit-déjeuner', short: 'Matin', h: '08:00', full: false, hint: '2 œufs à la coque ou durs + 2 galettes de riz', modulen: true },
    { id: 'col1', label: 'Collation du matin', short: '10 h', h: '10:30', full: false, hint: '1 banane mûre', modulen: true },
    { id: 'dej',  label: 'Déjeuner', short: 'Midi', h: '12:30', full: true, hint: 'Féculent + légume + protéine', modulen: false },
    { id: 'col2', label: "Collation de l'après-midi", short: '16 h', h: '16:00', full: false, hint: 'Pomme cuite à la cannelle + 2 galettes', modulen: true },
    { id: 'din',  label: 'Dîner', short: 'Soir', h: '19:30', full: true, hint: 'Féculent + légume + protéine', modulen: false },
  ];

  // Moment hors du rythme : il se note sans feuille et sans jugement
  const EXTRA = { id: 'hors', label: 'Hors repas', short: 'Autre', full: false, hint: 'Un grignotage, une envie, un repas décalé' };

  // Ressenti avant de manger, facultatif
  const FEELINGS = [
    { id: 'faim', label: 'Faim' }, { id: 'envie', label: 'Envie' }, { id: 'stress', label: 'Stress' },
    { id: 'ennui', label: 'Ennui' }, { id: 'triste', label: 'Tristesse' }, { id: 'fatigue', label: 'Fatigue' },
    { id: 'bien', label: 'Bien' },
  ];

  const GROUPS = { base: 'Féculent', legume: 'Légume', proteine: 'Protéine', fruit: 'Fruit', autre: 'Placard' };

  // kw : expressions recherchées dans la description (texte sans accents)
  // portions : nombre de prises couvertes par la quantité de la semaine
  const FOODS = [
    { id: 'riz', name: 'Riz blanc', e: '🍚', group: 'base', rayon: 'Épicerie', qty: '1 kg', portions: 11, kw: 'riz' },
    { id: 'pdt', name: 'Pommes de terre', e: '🥔', group: 'base', rayon: 'Fruits et légumes', qty: '2,5 kg', portions: 8, kw: 'pommes? de terre|patates?|puree' },
    { id: 'galette', name: 'Galettes de riz', e: '🍘', group: 'base', rayon: 'Épicerie', qty: '28 (riz + sel uniquement)', portions: 14, kw: 'galettes?' },
    { id: 'carotte', name: 'Carotte', e: '🥕', group: 'legume', rayon: 'Fruits et légumes', qty: '1 kg', portions: 4, kw: 'carottes?' },
    { id: 'courgette', name: 'Courgette', e: '🥒', group: 'legume', rayon: 'Fruits et légumes', qty: '1,5 kg', portions: 5, kw: 'courgettes?' },
    { id: 'courge', name: 'Potiron ou butternut', e: '🎃', group: 'legume', rayon: 'Fruits et légumes', qty: '1 pièce (1 kg)', portions: 5, kw: 'potiron|butternut|courge|soupe' },
    { id: 'poireau', name: 'Blanc de poireau', e: '🌱', group: 'legume', rayon: 'Fruits et légumes', qty: '3 poireaux', portions: 2, kw: 'poireaux?' },
    { id: 'poulet', name: 'Blanc de poulet', e: '🍗', group: 'proteine', rayon: 'Viande et poisson', qty: '750 g', portions: 5, kw: 'poulet' },
    { id: 'oeuf', name: 'Œufs', e: '🥚', group: 'proteine', rayon: 'Œufs', qty: '18', portions: 9, kw: 'oeufs?' },
    { id: 'poisson', name: 'Poisson blanc', e: '🐟', group: 'proteine', rayon: 'Viande et poisson', qty: '500 g (cabillaud, colin, merlu)', portions: 3, kw: 'poisson|cabillaud|colin|merlu' },
    { id: 'saumon', name: 'Saumon', e: '🍣', group: 'proteine', rayon: 'Viande et poisson', qty: '2 pavés (300 g)', portions: 2, kw: 'saumon' },
    { id: 'crevette', name: 'Crevettes nature', e: '🦐', group: 'proteine', rayon: 'Viande et poisson', qty: '300 g sans additif', portions: 2, kw: 'crevettes?' },
    { id: 'banane', name: 'Banane mûre', e: '🍌', group: 'fruit', rayon: 'Fruits et légumes', qty: '8', portions: 8, kw: 'bananes?' },
    { id: 'pomme', name: 'Pomme cuite ou compote', e: '🍎', group: 'fruit', rayon: 'Fruits et légumes', qty: '8', portions: 8, kw: 'pommes?(?! de terre)|compote' },
    { id: 'huile', name: "Huile d'olive", e: '🫒', group: 'autre', rayon: 'Épicerie', qty: '25 cl', portions: 28, kw: 'huile' },
    { id: 'epices', name: 'Gingembre, curcuma, cannelle, herbes', e: '🌿', group: 'autre', rayon: 'Épicerie', qty: '1 petit pot de chaque', portions: 60, kw: 'gingembre|curcuma|cannelle' },
  ];

  // Produits à éviter repérés dans la description. Aucun point n'est retiré.
  const AVOID = [
    'pain', 'pates?', 'ble', 'gluten', 'lait', 'fromages?', 'yaourts?', 'beurre', 'creme', 'soja',
    'charcuterie', 'jambon', 'saucisson', 'saucisses?', 'lardons?', 'panes?', 'panee?s?', 'frites?', 'friture', 'fast.?food',
    'burger', 'kebab', 'pizza', 'plat prepare', 'gateaux?', 'cookies?', 'biscuits?', 'patisseries?', 'avoine',
    'flocons?', 'farine', 'crudites?', 'salade', 'lentilles?', 'pois chiches?', 'haricots?', 'noix', 'amandes?',
    'noisettes?', 'fruits secs?', 'choux?', 'epinards?', 'tomates?', 'sodas?', 'jus', 'cafe', 'alcool',
    'vin', 'bieres?', 'sucre', 'bonbons?', 'chocolat', 'edulcorants?',
  ];

  const AVOID_TEXT = [
    'Desserts élaborés, flocons, avoine, farines, cookies, pâtisseries',
    'Produits laitiers, blé et gluten, sauce soja',
    'Charcuterie, viandes panées, fast-food, fritures, plats préparés',
    'Crudités, peaux, graines, légumineuses, fruits à coque, fruits secs',
    'Vert de poireau, choux, épinards, tomates',
    'Sucre ajouté, édulcorants, sodas, jus, café, alcool',
  ];

  const ALERTS = [
    'Sang dans les selles', 'Fièvre supérieure à 38 °C', 'Nette hausse du nombre de selles ou selles nocturnes',
    'Fortes douleurs', "Douleur ou gonflement près de l'anus", 'Vertiges', 'Très peu d’urine',
  ];

  const LEVELS = [
    { name: 'Graine', min: 0 }, { name: 'Germe', min: 150 }, { name: 'Pousse', min: 500 },
    { name: 'Plant', min: 1200 }, { name: 'Arbuste', min: 2500 }, { name: 'Arbre', min: 5000 },
  ];

  const WATER_GOAL = 8; // 8 verres de 25 cl = 2 L
  const DATA = { MOMENTS, EXTRA, FEELINGS, GROUPS, FOODS, AVOID, AVOID_TEXT, ALERTS, LEVELS, WATER_GOAL };
  if (typeof module !== 'undefined' && module.exports) module.exports = DATA;
  else root.DATA = DATA;
})(this);
