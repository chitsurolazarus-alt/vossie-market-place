// Search terms for the real photos (Pexels). Keys are listing titles (exactly as seeded) or "site:<name>".
// Terms avoid brand names on purpose (no logos or trademarks in the photos); every downloaded photo is still checked by eye.
export const LISTING_QUERIES = {
  // beauty
  "Beard trim and shape": "barber trimming beard",
  "Braids for laptop repair": "braided hairstyle black woman",
  "Cornrows (straight back)": "cornrows hairstyle",
  "Haircut for data or airtime": "barber cutting hair",
  "Knotless braids (medium)": "knotless box braids",
  "Res room haircut (2 friends)": "friends getting haircut at home",
  "Skin fade and line-up": "skin fade haircut",
  "Take-down and wash": "washing natural hair",
  // design
  "CV and LinkedIn makeover": "resume on desk laptop",
  "Event poster or flyer": "poster design on desk",
  "Instagram post pack (5 designs)": "social media content phone flatlay",
  "Logo design (2 concepts)": "logo sketches designer desk",
  // events
  "Balloon arch (small)": "balloon arch decoration",
  "Party props box": "party decorations props",
  "Res birthday setup": "birthday party table setup",
  "Society event coordinator": "event planner coordinating",
  // fashion
  "Custom laces set (3 pairs)": "colorful shoelaces",
  "Pre-loved Air Force 1 (size 8)": "pair of white leather sneakers",
  "Sneaker deep clean": "cleaning sneakers with brush",
  "Sole whitening and restoration": "sneaker sole cleaning",
  // food
  "Birthday cupcake box (12)": "box of cupcakes",
  "Chicken kota with atchar": "street food sandwich with chips",
  "Chilli bites tray (20)": "fried snacks tray",
  "Vetkoek and mince (2 pack)": "fried bread with mince",
  "Weekend baking box": "baking ingredients flour eggs",
  // tech
  "Laptop clean-up and speed boost": "laptop repair technician",
  "Phone screen protector and setup": "applying phone screen protector",
  "Refurbished 32GB flash drive": "usb flash drive",
  "Simple website for your hustle": "web design on laptop",
  // tutoring
  "Financial Accounting tutoring (1 hour)": "student studying accounting calculator",
  "Maths 1 exam crash course": "mathematics equations chalkboard",
  "Summarised study notes bundle": "study notes highlighter",
  "Tutoring for a design job": "tutor helping student laptop",
};

// Landing page and section photos (used from Stage 9).
export const SITE_QUERIES = {
  "site:hero": "university students walking on campus",
  "site:hero-2": "young entrepreneur selling at market stall",
  "site:how-browse": "student browsing phone outdoors",
  "site:how-chat": "two students chatting on bench",
  "site:how-collect": "handing over a package",
  "site:delivery": "courier delivering parcel",
  "site:transport": "student riding scooter delivery",
  "site:payment": "paying with phone contactless",
  "site:trust": "friends shaking hands",
  "site:sell": "young woman packing orders at home",
};

// Wikimedia Commons matches words in file names and descriptions, so plain nouns work best there.
// Each term was tuned by looking at what came back (wrong subject, brand logos or minors are rejected by eye).
export const COMMONS_QUERIES = {
  "Beard trim and shape": "barber beard trim", "Braids for laptop repair": "hair braiding salon", "Cornrows (straight back)": "braided hair African woman back view",
  "Haircut for data or airtime": "barber haircut", "Knotless braids (medium)": "box braids hairstyle", "Res room haircut (2 friends)": "haircut at home",
  "Skin fade and line-up": "fade haircut barber", "Take-down and wash": "hair wash salon",
  "CV and LinkedIn makeover": "resume document pen", "Event poster or flyer": "poster printing flyer", "Instagram post pack (5 designs)": "smartphone photography",
  "Logo design (2 concepts)": "graphic designer working",
  "Balloon arch (small)": "balloon arch", "Party props box": "party hats balloons", "Res birthday setup": "birthday party decorations", "Society event coordinator": "student society event",
  "Custom laces set (3 pairs)": "shoelaces", "Pre-loved Air Force 1 (size 8)": "white sneakers", "Sneaker deep clean": "shoe cleaning brush", "Sole whitening and restoration": "sneakers shoes",
  "Birthday cupcake box (12)": "box of cupcakes", "Chicken kota with atchar": "South African street food", "Chilli bites tray (20)": "fried snacks",
  "Vetkoek and mince (2 pack)": "vetkoek", "Weekend baking box": "baking flour eggs",
  "Laptop clean-up and speed boost": "laptop repair", "Phone screen protector and setup": "smartphone screen protector", "Refurbished 32GB flash drive": "usb stick",
  "Simple website for your hustle": "web developer coding laptop",
  "Financial Accounting tutoring (1 hour)": "accounting calculator", "Maths 1 exam crash course": "mathematics homework", "Summarised study notes bundle": "notebook notes pen desk",
  "Tutoring for a design job": "tutor teaching student",
};
