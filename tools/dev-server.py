#!/usr/bin/env python3
"""No-cache local development server for Legend Eternal."""

from __future__ import annotations

import argparse
import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Sequence

DEFAULT_BIND = "127.0.0.1"
DEFAULT_PORT = 4173
PROJECT_ROOT = Path(__file__).resolve().parent.parent


class NoCacheHTTPRequestHandler(SimpleHTTPRequestHandler):
    """Serve static files while forcing every request to read fresh content."""

    def send_head(self):  # type: ignore[no-untyped-def]
        # SimpleHTTPRequestHandler supports If-Modified-Since and may return 304.
        # Remove conditional cache headers so an old browser cache cannot win on
        # the first refresh after switching to this development server.
        for header_name in ("If-Modified-Since", "If-None-Match"):
            if header_name in self.headers:
                del self.headers[header_name]
        return super().send_head()

    def end_headers(self) -> None:
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def copyfile(self, source, outputfile) -> None:  # type: ignore[no-untyped-def]
        """Ignore expected client disconnects while streaming static assets."""

        try:
            super().copyfile(source, outputfile)
        except (ConnectionResetError, BrokenPipeError):
            # Browsers may cancel an in-flight media/image response when the
            # current scene changes or the page reloads. The request is already
            # obsolete from the client's perspective, so this is not a server
            # failure and should not print a traceback during local development.
            return


def parse_args(argv: Sequence[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="啟動《傳說永恆》本機 no-cache 靜態開發伺服器。"
    )
    parser.add_argument(
        "--bind",
        default=DEFAULT_BIND,
        help=f"綁定位置，預設 {DEFAULT_BIND}",
    )
    parser.add_argument(
        "--port",
        type=int,
        default=DEFAULT_PORT,
        help=f"監聽 port，預設 {DEFAULT_PORT}",
    )
    parser.add_argument(
        "--directory",
        type=Path,
        default=PROJECT_ROOT,
        help="網站根目錄，預設自動使用專案根目錄",
    )
    return parser.parse_args(argv)


def read_project_version(directory: Path) -> str:
    version_path = directory / "VERSION"
    try:
        return version_path.read_text(encoding="utf-8").strip() or "未知"
    except (OSError, UnicodeError):
        return "未知"


def main(argv: Sequence[str] | None = None) -> int:
    args = parse_args(argv)
    directory = args.directory.expanduser().resolve()

    if not directory.is_dir():
        print(f"錯誤：找不到網站根目錄：{directory}", file=sys.stderr)
        return 2

    if not 1 <= args.port <= 65535:
        print("錯誤：port 必須介於 1 到 65535。", file=sys.stderr)
        return 2

    handler = partial(NoCacheHTTPRequestHandler, directory=str(directory))

    try:
        server = ThreadingHTTPServer((args.bind, args.port), handler)
    except OSError as exc:
        print(
            f"錯誤：無法啟動 http://{args.bind}:{args.port}/：{exc}",
            file=sys.stderr,
        )
        print("請確認 port 是否被占用，或改用 --port 4174。", file=sys.stderr)
        return 1

    version = read_project_version(directory)
    print("《傳說永恆》本機開發伺服器")
    print(f"專案版本：{version}")
    print(f"服務目錄：{directory}")
    print(f"開啟網址：http://{args.bind}:{args.port}/")
    print("快取策略：no-store（每次重新整理都讀取最新檔案）")
    print("按 Ctrl+C 停止伺服器。")

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n已停止本機開發伺服器。")
    finally:
        server.server_close()

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
