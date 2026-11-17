/* Pousse : données du plan alimentaire. À adapter librement. */
(function (root) {
  // Repères de rythme, sans quantité imposée
  const MOMENTS = [
    { id: 'pdj',  label: 'Petit-déjeuner', short: 'Matin', h: '08:00', full: false, hint: 'Œufs, galettes de riz, banane…' },
    { id: 'col1', label: 'Collation du matin', short: '10 h', h: '10:30', full: false, hint: 'Un fruit doux ou une compote' },
    { id: 'dej',  label: 'Déjeuner', short: 'Midi', h: '12:30', full: true, hint: 'Féculent + légume + protéine' },
    { id: 'col2', label: "Collation de l'après-midi", short: '16 h', h: '16:00', full: false, hint: 'Pomme cuite, galettes de riz…' },
    { id: 'din',  label: 'Dîner', short: 'Soir', h: '19:30', full: true, hint: 'Féculent + légume + protéine' },
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
  // tip : précision utile en magasin (jamais une quantité imposée)
  // portions : nombre de prises avant que l'appli considère le produit presque fini (estimation du stock)
  const FOODS = [
    { id: 'riz', name: 'Riz blanc', e: '🍚', group: 'base', rayon: 'Épicerie', tip: '', portions: 11, kw: 'riz' },
    { id: 'pdt', name: 'Pommes de terre', e: '🥔', group: 'base', rayon: 'Fruits et légumes', tip: '', portions: 8, kw: 'pommes? de terre|patates?|puree|frites? au four' },
    { id: 'galette', name: 'Galettes de riz', e: '🍘', group: 'base', rayon: 'Épicerie', tip: 'Riz et sel uniquement', portions: 14, kw: 'galettes?' },
    { id: 'carotte', name: 'Carotte', e: '🥕', group: 'legume', rayon: 'Fruits et légumes', tip: '', portions: 4, kw: 'carottes?' },
    { id: 'courgette', name: 'Courgette', e: '🥒', group: 'legume', rayon: 'Fruits et légumes', tip: '', portions: 5, kw: 'courgettes?' },
    { id: 'courge', name: 'Potiron ou butternut', e: '🎃', group: 'legume', rayon: 'Fruits et légumes', tip: '', portions: 5, kw: 'potiron|butternut|courge|soupe|veloute' },
    { id: 'poireau', name: 'Blanc de poireau', e: '🌱', group: 'legume', rayon: 'Fruits et légumes', tip: 'Le blanc passe mieux que le vert', portions: 2, kw: 'poireaux?' },
    { id: 'poulet', name: 'Blanc de poulet', e: '🍗', group: 'proteine', rayon: 'Viande et poisson', tip: '', portions: 5, kw: 'poulet' },
    { id: 'oeuf', name: 'Œufs', e: '🥚', group: 'proteine', rayon: 'Œufs', tip: '', portions: 9, kw: 'oeufs?|omelette' },
    { id: 'poisson', name: 'Poisson blanc', e: '🐟', group: 'proteine', rayon: 'Viande et poisson', tip: 'Cabillaud, colin, merlu, frais ou surgelé nature', portions: 3, kw: 'poisson|cabillaud|colin|merlu' },
    { id: 'saumon', name: 'Saumon', e: '🍣', group: 'proteine', rayon: 'Viande et poisson', tip: '', portions: 2, kw: 'saumon' },
    { id: 'crevette', name: 'Crevettes nature', e: '🦐', group: 'proteine', rayon: 'Viande et poisson', tip: 'Sans additif ni marinade', portions: 2, kw: 'crevettes?' },
    { id: 'banane', name: 'Banane mûre', e: '🍌', group: 'fruit', rayon: 'Fruits et légumes', tip: '', portions: 8, kw: 'bananes?' },
    { id: 'pomme', name: 'Pomme cuite ou compote', e: '🍎', group: 'fruit', rayon: 'Fruits et légumes', tip: 'Compote sans sucre ajouté', portions: 8, kw: 'pommes?(?! de terre)|compote' },
    { id: 'huile', name: "Huile d'olive", e: '🫒', group: 'autre', rayon: 'Épicerie', tip: '', portions: 28, kw: 'huile' },
    { id: 'epices', name: 'Gingembre, curcuma, cannelle, herbes', e: '🌿', group: 'autre', rayon: 'Épicerie', tip: '', portions: 60, kw: 'gingembre|curcuma|cannelle' },
  ];

  // Produits qui irritent souvent l'intestin en poussée, repérés dans la description.
  // Ils sont seulement signalés pour le suivi digestif. Aucun point n'est retiré, aucun jugement.
  const AVOID = [
    'pain', 'pates?', 'ble', 'gluten', 'lait', 'fromages?', 'yaourts?', 'beurre', 'creme', 'soja',
    'charcuterie', 'jambon', 'saucisson', 'saucisses?', 'lardons?', 'panes?', 'panee?s?', 'frites?(?! au four)', 'friture', 'fast.?food',
    'burger', 'kebab', 'pizza', 'plat prepare', 'gateaux?', 'cookies?', 'biscuits?', 'patisseries?', 'avoine',
    'flocons?', 'farine', 'crudites?', 'salade', 'lentilles?', 'pois chiches?', 'haricots?', 'noix', 'amandes?',
    'noisettes?', 'fruits secs?', 'choux?', 'epinards?', 'tomates?', 'sodas?', 'jus', 'cafe', 'alcool',
    'vin', 'bieres?', 'sucre', 'bonbons?', 'chocolat', 'edulcorants?',
  ];

  const AVOID_TEXT = [
    'Fritures, fast-food, viandes panées, plats préparés',
    'Crudités, peaux, graines, légumineuses, fruits à coque',
    'Produits laitiers, blé, sauce soja',
    'Plats très gras ou très épicés',
    'Sodas, café, alcool, boissons très froides',
    'Les flocons et les cookies ne t’ont pas réussi récemment',
  ];

  // Additifs souvent déconseillés dans les MICI (émulsifiants et épaississants), lus sur Open Food Facts
  const ADDITIVES = {
    'en:e433': 'Polysorbate 80 (émulsifiant)',
    'en:e466': 'Carboxyméthylcellulose (émulsifiant)',
    'en:e407': 'Carraghénanes (épaississant)',
    'en:e407a': 'Carraghénanes (épaississant)',
    'en:e415': 'Gomme xanthane (épaississant)',
    'en:e471': 'Mono- et diglycérides (émulsifiant)',
    'en:e472e': 'Esters (émulsifiant)',
    'en:e460': 'Cellulose (épaississant)',
    'en:e464': 'Hydroxypropylméthylcellulose (épaississant)',
    'en:e1422': 'Amidon modifié (épaississant)',
    'en:e950': 'Acésulfame K (édulcorant)', 'en:e951': 'Aspartame (édulcorant)', 'en:e955': 'Sucralose (édulcorant)',
    'en:e420': 'Sorbitol (édulcorant, laxatif)', 'en:e421': 'Mannitol (édulcorant, laxatif)', 'en:e965': 'Maltitol (édulcorant, laxatif)',
  };
  const ALLERGENS = { 'en:gluten': 'Gluten', 'en:milk': 'Lait' };

  // Suivi digestif du jour, sans score
  const STOOLS = [
    { id: 'liquide', label: 'Liquides' }, { id: 'molle', label: 'Molles' }, { id: 'moulee', label: 'Moulées' },
  ];
  const PAIN = ['Aucune', 'Légère', 'Moyenne', 'Forte'];
  const ENERGY = ['Bonne', 'Moyenne', 'Faible'];

  // Recettes simples, sans quantité imposée. needs : produits nécessaires (identifiants de FOODS)
  const RECIPES = [
    { id: 'soupe', name: 'Soupe mixée carotte-poireau', needs: ['carotte', 'pdt'], steps: [
      'Épluche carottes et pommes de terre, coupe le blanc de poireau.',
      'Couvre d’eau salée et cuis 25 minutes.',
      'Mixe très fin avec un filet d’huile d’olive. Se garde 3 jours au frigo.'] },
    { id: 'wok', name: 'Riz sauté aux crevettes façon wok', needs: ['riz', 'crevette'], steps: [
      'Fais revenir un peu de gingembre râpé dans une cuillère d’huile.',
      'Ajoute le riz déjà cuit, des carottes fondantes et les crevettes.',
      'Termine avec un œuf brouillé et du sel. Pas de sauce soja, elle contient du blé.'] },
    { id: 'frites', name: 'Frites au four', needs: ['pdt'], steps: [
      'Coupe les pommes de terre épluchées en bâtonnets, rince et sèche-les.',
      'Mélange avec une cuillère d’huile et du sel.',
      'Four à 200 °C pendant 30 minutes en les retournant une fois.'] },
    { id: 'poisson', name: 'Poisson blanc et purée', needs: ['poisson', 'pdt'], steps: [
      'Cuis le poisson au four 12 minutes à 180 °C avec citron et herbes.',
      'Écrase les pommes de terre cuites avec de l’huile d’olive et un peu d’eau de cuisson.'] },
    { id: 'fondantes', name: 'Carottes fondantes', needs: ['carotte'], steps: [
      'Coupe les carottes en rondelles.',
      'Cuis 20 minutes à couvert avec un fond d’eau, du sel et un peu d’huile.'] },
    { id: 'pomme', name: 'Pomme cuite à la cannelle', needs: ['pomme'], steps: [
      'Épluche et coupe la pomme.',
      'Cuis 10 minutes à feu doux avec un fond d’eau et de la cannelle.'] },
  ];

  const ALERTS = [
    'Sang dans les selles', 'Fièvre supérieure à 38 °C', 'Nette hausse du nombre de selles ou selles nocturnes',
    'Fortes douleurs', "Douleur ou gonflement près de l'anus", 'Vertiges', 'Très peu d’urine',
  ];

  const LEVELS = [
    { name: 'Graine', min: 0 }, { name: 'Germe', min: 150 }, { name: 'Pousse', min: 500 },
    { name: 'Plant', min: 1200 }, { name: 'Arbuste', min: 2500 }, { name: 'Arbre', min: 5000 },
  ];

  const WATER_GOAL = 8; // repère : 8 verres de 25 cl, utile avec des selles liquides
  const DATA = { MOMENTS, EXTRA, FEELINGS, GROUPS, FOODS, AVOID, AVOID_TEXT, ADDITIVES, ALLERGENS, STOOLS, PAIN, ENERGY, RECIPES, ALERTS, LEVELS, WATER_GOAL };
  if (typeof module !== 'undefined' && module.exports) module.exports = DATA;
  else root.DATA = DATA;
})(this);
