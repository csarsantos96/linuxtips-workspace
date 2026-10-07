package main

import (
	"fmt"
	"os"

	"github.com/csarsantos96/mkube/internal/version"
)

func main() {
	if len(os.Args) >= 2 && os.Args[1] == "version" {
		fmt.Printf("mkube %s\n", version.Version)
		return
	}
	fmt.Fprintln(os.Stderr, "uso: mkube version|get|describe|logs|...")
	os.Exit(2)
}
