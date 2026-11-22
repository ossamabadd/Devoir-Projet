import argparse
import json
import os
from pathlib import Path
import shutil
import socket
import subprocess
import sys
import time
from urllib.error import URLError
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parent
LOGS = ROOT / ".local" / "logs"
SERVICES = {
    "config-service": 8888,
    "discovery-service": 8761,
    "customer-service": 8081,
    "ebank-service": 8082,
    "gateway-service": 8080,
    "chatbot-service": 8093,
}


def build():
    wrapper = ROOT / ("mvnw.cmd" if os.name == "nt" else "mvnw")
    maven = [str(wrapper)] if os.name == "nt" else ["sh", str(wrapper)]
    subprocess.run([*maven, "-ntp", "package"], cwd=ROOT, check=True)
    npm = shutil.which("npm.cmd" if os.name == "nt" else "npm")
    if not npm:
        raise RuntimeError("Install Node.js 24 and npm to build Angular.")
    for args in (["ci", "--no-audit", "--no-fund"], ["run", "build"]):
        subprocess.run([npm, *args], cwd=ROOT / "frontend", check=True)


def wait_for(name, path, processes):
    deadline = time.monotonic() + 120
    url = f"http://127.0.0.1:{SERVICES[name]}{path}"
    while time.monotonic() < deadline:
        check_processes(processes)
        try:
            with urlopen(url, timeout=3) as response:
                json.load(response)
                return
        except (URLError, TimeoutError):
            time.sleep(1)
    raise RuntimeError(f"Timed out waiting for {url}. See {LOGS}.")


def check_processes(processes):
    for name, process in processes.items():
        if process.poll() is not None:
            raise RuntimeError(f"{name} exited with code {process.returncode}. See {LOGS / (name + '.log')}.")


def serve():
    java = shutil.which("java")
    if not java:
        raise RuntimeError("Install a Java 21+ JDK and add java to PATH.")
    if not (ROOT / "frontend/dist/ebank/browser/index.html").is_file():
        raise RuntimeError("Angular has not been built. Run python run.py --build.")
    jars = {}
    for name, port in SERVICES.items():
        matches = list((ROOT / name / "target").glob(f"{name}-*.jar"))
        if len(matches) != 1:
            raise RuntimeError(f"Expected one packaged JAR for {name}. Run python run.py --build.")
        jars[name] = matches[0]
        with socket.socket() as probe:
            if probe.connect_ex(("127.0.0.1", port)) == 0:
                raise RuntimeError(f"Port {port} for {name} is already in use.")
    LOGS.mkdir(parents=True, exist_ok=True)
    processes = {}
    try:
        for name in SERVICES:
            print(f"Starting {name}…", flush=True)
            with (LOGS / (name + ".log")).open("wb") as log:
                processes[name] = subprocess.Popen(
                    [java, "-Xms32m", "-Xmx256m", "-XX:ActiveProcessorCount=2", "-jar", str(jars[name])],
                    cwd=ROOT, stdout=log, stderr=subprocess.STDOUT,
                )
            wait_for(name, "/actuator/health", processes)
        for path in ("/api/customers", "/api/accounts"):
            wait_for("gateway-service", path, processes)
        print("Ebank is ready at http://127.0.0.1:8080/ . Press Ctrl+C to stop.", flush=True)
        while True:
            check_processes(processes)
            time.sleep(1)
    finally:
        for process in reversed(list(processes.values())):
            if process.poll() is None:
                process.terminate()
        for process in processes.values():
            try:
                process.wait(timeout=10)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Build and run Ebank locally.")
    parser.add_argument("--build", action="store_true", help="Build the backend and frontend first.")
    options = parser.parse_args()
    try:
        if options.build:
            build()
        serve()
    except KeyboardInterrupt:
        print("Stopped.")
    except (RuntimeError, OSError, subprocess.CalledProcessError) as error:
        sys.exit(str(error))
