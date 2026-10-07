# =====================================================================
#  theme_stagekit.R: ggplot2 figures that look like stagekit slides
#
#  Candidate for stagekit (tools/r/): colours come from the deck's
#  style.toml, sizes are the four stagekit sizes (20, 32, 48, 80 px),
#  and save_slide_svg() writes an SVG whose units are slide pixels, so a
#  figure placed in a .figure box shows text at exactly those sizes.
#
#  Design rules, the same as for drawings in draw.js:
#  - transparent background, the slide's black shows through
#  - no chart title (the slide heading is the title), no legend box
#  - grid lines only along the value axis, in gray_dark, nothing else
#  - axis titles in gray, axis text in gray_light, 32 px, Arial
#  - data in gray_light; one highlighted element in yellow (what the
#    slide is about), a second one in white; red only as a warning
#  - numbers as text in 32 px; decimal point as in the slide language
# =====================================================================

library(ggplot2)

# Read the [colors] table of a style.toml (flat key = "RRGGBB" pairs).
read_stagekit_colors <- function(style_file) {
  lines <- readLines(style_file, encoding = "UTF-8")
  start <- which(trimws(lines) == "[colors]")
  if (length(start) == 0) stop("no [colors] table in ", style_file)
  rest <- lines[(start + 1):length(lines)]
  end <- which(grepl("^\\s*\\[", rest))[1]
  if (!is.na(end)) rest <- rest[seq_len(end - 1)]
  rest <- sub("#.*$", "", rest)
  pairs <- regmatches(rest, regexec('^\\s*([a-z_]+)\\s*=\\s*"([0-9A-Fa-f]{6})"', rest))
  pairs <- pairs[lengths(pairs) == 3]
  stats::setNames(paste0("#", vapply(pairs, `[`, "", 3)), vapply(pairs, `[`, "", 2))
}

# The four text sizes of stagekit, in slide pixels
stagekit_sizes <- c(tiny = 20, small = 32, normal = 48, large = 80)

# ggplot2 measures theme text in points and geom text in millimetres;
# with save_slide_svg() one point is one slide pixel
stagekit_text_size <- function(px) px / ggplot2::.pt

theme_stagekit <- function(colors, flip = FALSE, base_family = "Arial") {
  grid_line <- element_line(colour = colors[["gray_dark"]], linewidth = 1 / ggplot2::.pt * 1.5)
  theme_minimal(base_size = stagekit_sizes[["small"]], base_family = base_family) +
    theme(
      plot.background = element_rect(fill = "transparent", colour = NA),
      panel.background = element_rect(fill = "transparent", colour = NA),
      text = element_text(colour = colors[["gray_light"]]),
      axis.text = element_text(colour = colors[["gray_light"]], size = stagekit_sizes[["small"]]),
      axis.title = element_text(colour = colors[["gray"]], size = stagekit_sizes[["small"]]),
      axis.title.x = element_text(margin = margin(t = 28)),
      axis.title.y = element_text(margin = margin(r = 28)),
      axis.text.x = element_text(margin = margin(t = 14)),
      axis.text.y = element_text(margin = margin(r = 14)),
      axis.ticks = element_blank(),
      panel.grid.minor = element_blank(),
      panel.grid.major.x = if (flip) grid_line else element_blank(),
      panel.grid.major.y = if (flip) element_blank() else grid_line,
      legend.position = "none",
      plot.title = element_blank(),
      plot.margin = margin(10, 20, 10, 10)
    )
}

# Save a plot as SVG in slide pixels (1 pt = 1 px). Default size is the
# free area of a slide with a small heading: 1680 x 760.
save_slide_svg <- function(plot, file, width_px = 1680, height_px = 760) {
  svglite::svglite(file, width = width_px / 72, height = height_px / 72, bg = "transparent",
                   system_fonts = list(sans = "Arial"))
  on.exit(grDevices::dev.off())
  print(plot)
  invisible(file)
}
