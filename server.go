package main

import (
    "log"
    "net/http"
)

func main() {
    dir := "/site"
    fs := http.FileServer(http.Dir(dir))
    http.Handle("/", fs)
    log.Println("minqi-guidance listening on :8080")
    if err := http.ListenAndServe(":8080", nil); err != nil {
        log.Fatal(err)
    }
}
