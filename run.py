import os
import shutil
import subprocess
import sys

PROJECT_DIR = os.path.abspath(".")  # Angular project root

FOLDERS_TO_DELETE = [
    "node_modules",
    "dist",
    ".angular",
    "coverage",
   # "package-lock.json"
]


def delete_folder(folder_name):
    path = os.path.join(PROJECT_DIR, folder_name)

    if os.path.exists(path):
        print(f"Removing {folder_name}...")
        shutil.rmtree(path)
        print(f"✅ Removed {folder_name}")
    else:
        print(f"⏭️ Skipping {folder_name} (not found)")


def run_command(command):
    print(f"\n🔄 Running: {' '.join(command)}")

    result = subprocess.run(
        command,
        cwd=PROJECT_DIR,
        text=True
    )

    if result.returncode != 0:
        print(f"\n❌ ERROR: Command failed: {' '.join(command)}")
        sys.exit(result.returncode)

    print(f"✓ Success: {' '.join(command)}")


def main():
    try:
        print("🔄 Angular Clean Build Script🔄\n")

        # Clean folders
        for folder in FOLDERS_TO_DELETE:
            delete_folder(folder)

        print("node =", shutil.which("node"))
        print("npm  =", shutil.which("npm"))
        print("npm.cmd =", shutil.which("npm.cmd"))

        run_command(["node", "--version"])
        NPM = "npm.cmd"

        run_command([NPM, "--version"])

        run_command([NPM, "install"])
        run_command([NPM, "test", "--", "--watch=false"])
        run_command([NPM, "run", "build"])
        # Start application
        print("\nStarting application...")
        subprocess.run([NPM, "start"], cwd=PROJECT_DIR)

    except Exception as e:
        print(f"\n❌ Unexpected error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()