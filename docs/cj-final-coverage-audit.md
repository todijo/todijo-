# CJ final taxonomy coverage audit

Production snapshot: 578 third-level CJ leaves, 561 mapped, 17 unmapped (97.06% coverage).

## Safe gaps to resolve

1. Pet Supplies > Pet Toys > Pet Toy Set
2. Phones & Accessories > Cases & Covers > Cases For iPhone 6 & 6 Plus
3. Phones & Accessories > Cases & Covers > Cases For iPhone 7 & 7 Plus
4. Phones & Accessories > Cases & Covers > Cases For iPhone 8 & 8 Plus
5. Phones & Accessories > Cases & Covers > Galaxy S7 Cases
6. Phones & Accessories > Cases & Covers > Galaxy S8 Cases
7. Sports & Outdoors > Other Sports Equipment > Musical Instruments
8. Toys, Kids & Babies > Baby Clothing > Baby Outerwear
9. Toys, Kids & Babies > Boys Clothing > Boy Accessories
10. Toys, Kids & Babies > Girls Clothing > Family Matching Outfits
11. Toys, Kids & Babies > Girls Clothing > Girl Accessories
12. Toys, Kids & Babies > Girls Clothing > Sleepwear & Robes
13. Women's Clothing > Accessories > Eyewear & Accessories

These are ordinary marketplace taxonomy gaps. They may be mapped only to a validated existing canonical leaf or added as reviewed additive leaves; no heuristic guessing is allowed.

## Intentionally unmapped / review-required

1. Health, Beauty & Hair > Food & Health > Health Care Products
2. Home, Garden & Furniture > Home Storage > Adult Wellness
3. Men's Clothing > Accessories > Man Prescription Glasses
4. Women's Clothing > Accessories > Woman Prescription Glasses

These four remain fail-closed because they are regulated, medical/prescription, or otherwise require product-level compliance review. Coverage must not be increased by auto-accepting them.

## Target outcome

Resolve the 13 safe gaps while leaving the 4 protected gaps unmapped. Expected safe taxonomy coverage after deployment: 574 / 578 = 99.31%.