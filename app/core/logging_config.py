
import gzip
import logging
import os
import shutil
import time
from datetime import datetime
from pathlib import Path
from logging.handlers import TimedRotatingFileHandler


class LevelFilter(logging.Filter):
    """只允许指定级别的日志通过。"""

    def __init__(self, level, exact=True):
        super().__init__()
        self.level = level
        self.exact = exact

    def filter(self, record):
        if self.exact:
            return record.levelno == self.level
        return record.levelno >= self.level


class DailyLevelHandler(logging.Handler):
    """按日期 + 日志级别写文件，并压缩和清理历史日志。"""

    def __init__(self, log_dir, level_name, retention_days=30):
        super().__init__()
        self.log_dir = Path(log_dir)
        self.level_name = level_name.lower()
        self.retention_days = retention_days
        self.current_date = None
        self.stream = None
        self.current_path = None

        self.log_dir.mkdir(parents=True, exist_ok=True)
        self._open_for_today()
        self._cleanup()

    def _open_for_today(self):
        today = datetime.now().strftime("%Y-%m-%d")

        if self.current_date == today and self.stream:
            return

        if self.stream:
            self.stream.close()

        # 日期 + 日志级别
        self.current_path = self.log_dir / f"{today}-{self.level_name}.log"
        self.stream = open(self.current_path, "a", encoding="utf-8")
        self.current_date = today

        self._cleanup()

    def emit(self, record):
        try:
            self._open_for_today()
            message = self.format(record)
            self.stream.write(message + "\n")
            self.stream.flush()
        except Exception:
            self.handleError(record)

    def _cleanup(self):
        cutoff = time.time() - self.retention_days * 86400

        for path in self.log_dir.glob(f"*-{self.level_name}.log"):
            try:
                # 压缩昨天及更早的日志，不压缩当天文件
                date_text = path.name[:10]
                log_date = datetime.strptime(date_text, "%Y-%m-%d").date()
                today = datetime.now().date()

                if log_date < today and path.exists():
                    gz_path = Path(str(path) + ".gz")
                    with open(path, "rb") as src:
                        with gzip.open(gz_path, "wb") as dst:
                            shutil.copyfileobj(src, dst)
                    path.unlink()

            except (ValueError, FileNotFoundError):
                continue

        # 清理超过保留期限的压缩日志
        for path in self.log_dir.glob(f"*-{self.level_name}.log.gz"):
            try:
                if path.stat().st_mtime < cutoff:
                    path.unlink()
            except FileNotFoundError:
                continue

    def close(self):
        if self.stream:
            self.stream.close()
            self.stream = None
        super().close()


def setup_logging():
    log_dir = Path(os.getenv("LOG_DIR", "./logs")).expanduser()
    log_dir.mkdir(parents=True, exist_ok=True)

    level_name = os.getenv("LOG_LEVEL", "INFO").upper()
    retention_days = max(1, int(os.getenv("LOG_RETENTION_DAYS", "30")))

    formatter = logging.Formatter(
        "%(asctime)s | %(levelname)s | %(name)s | %(message)s"
    )

    root = logging.getLogger()
    root.setLevel(getattr(logging, level_name, logging.INFO))

    for handler in root.handlers[:]:
        root.removeHandler(handler)
        handler.close()

    # INFO、WARNING、ERROR、CRITICAL 分别写入自己的文件
    for name, level in [
        ("info", logging.INFO),
        ("warning", logging.WARNING),
        ("error", logging.ERROR),
        ("critical", logging.CRITICAL),
    ]:
        handler = DailyLevelHandler(
            log_dir, name, retention_days=retention_days
        )
        handler.setLevel(level)
        handler.addFilter(LevelFilter(level, exact=True))
        handler.setFormatter(formatter)
        root.addHandler(handler)

    # 同时输出到控制台
    console_handler = logging.StreamHandler()
    console_handler.setLevel(root.level)
    console_handler.setFormatter(formatter)
    root.addHandler(console_handler)

    # DEBUG 不写入上述级别文件；需要时可单独增加 debug handler