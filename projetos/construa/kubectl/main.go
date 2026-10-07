package main

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/csarsantos96/mkube/internal/version"
	"gopkg.in/yaml.v3"
)

type KubeConfig struct {
	CurrentContext string         `yaml:"current-context"`
	Clusters       []NamedCluster `yaml:"clusters"`
	Contexts       []NamedContext `yaml:"contexts"`
	Users          []NamedUser    `yaml:"users"`
}

type NamedCluster struct {
	Name    string  `yaml:"name"`
	Cluster Cluster `yaml:"cluster"`
}

type Cluster struct {
	Server string `yaml:"server"`
}

type NamedContext struct {
	Name    string  `yaml:"name"`
	Context Context `yaml:"context"`
}

type Context struct {
	Cluster   string `yaml:"cluster"`
	User      string `yaml:"user"`
	Namespace string `yaml:"namespace"`
}

type NamedUser struct {
	Name string `yaml:"name"`
	User User   `yaml:"user"`
}

type User struct {
	Token string `yaml:"token"`
}

func main() {
	if len(os.Args) == 2 && os.Args[1] == "version" {
		fmt.Printf("mkube %s\n", version.Version)
		return
	}

	if len(os.Args) >= 3 && os.Args[1] == "config" {
		if err := runConfig(os.Args[2:]); err != nil {
			fmt.Fprintln(os.Stderr, err)
			os.Exit(1)
		}
		return
	}

	fmt.Fprintln(os.Stderr, "uso: mkube version|get|describe|logs|...")
	os.Exit(2)
}

func runConfig(args []string) error {
	path, err := kubeconfigPath()
	if err != nil {
		return err
	}

	raw, err := os.ReadFile(path)
	if err != nil {
		return fmt.Errorf("não foi possível ler o kubeconfig %q: %w", path, err)
	}

	switch {
	case len(args) == 1 && args[0] == "current-context":
		var config KubeConfig

		if err := yaml.Unmarshal(raw, &config); err != nil {
			return fmt.Errorf("não foi possível parsear o kubeconfig: %w", err)
		}

		fmt.Println(config.CurrentContext)
		return nil

	case len(args) == 2 && args[0] == "view" && args[1] == "--raw":
		_, err := os.Stdout.Write(raw)
		return err

	default:
		return fmt.Errorf("uso: mkube config current-context | mkube config view --raw")
	}
}

func kubeconfigPath() (string, error) {
	if path := os.Getenv("KUBECONFIG"); path != "" {
		return filepath.Clean(path), nil
	}

	home, err := os.UserHomeDir()
	if err != nil {
		return "", fmt.Errorf("não foi possível descobrir o diretório home: %w", err)
	}

	return filepath.Join(home, ".kube", "config"), nil
}
