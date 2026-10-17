Custom cursors
--------------
Drop your own images in this folder (transparent PNG, about 32x32):

  hover.png    shown when the mouse is over buttons, links and cards
  default.png  (optional) replaces the normal arrow everywhere else

If hover.png is missing, hover.svg (the orange shuriken) is used instead.
If both are missing, the browser's normal pointer is used.

The numbers after each url() in src/index.css are the hotspot: the pixel that counts as the click point.
"16 16" is the centre of a 32x32 image; use "0 0" for a top-left tip.
