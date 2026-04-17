TEX = milestone2_report
PDF = $(TEX).pdf

all: $(PDF)

$(PDF): $(TEX).tex
	pdflatex -interaction=nonstopmode $(TEX).tex
	pdflatex -interaction=nonstopmode $(TEX).tex

clean:
	rm -f $(TEX).aux $(TEX).log $(TEX).out $(TEX).fdb_latexmk $(TEX).fls $(TEX).synctex.gz

distclean: clean
	rm -f $(PDF)

.PHONY: all clean distclean
