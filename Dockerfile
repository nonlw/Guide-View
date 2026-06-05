FROM scratch

COPY minqi-server /minqi-server
COPY index.html /site/index.html
COPY styles.css /site/styles.css
COPY script.js /site/script.js
COPY assets /site/assets
COPY data /site/data
COPY README.md /site/README.md

EXPOSE 8080

ENTRYPOINT ["/minqi-server"]
