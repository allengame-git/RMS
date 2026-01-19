#!/bin/bash
# ============================================
# RMS 資料重置執行腳本
# ============================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
UPLOADS_DIR="$PROJECT_DIR/public/uploads"

echo "============================================"
echo "  RMS 資料重置工具"
echo "============================================"
echo ""
echo "⚠️  警告：此操作將清除所有業務數據！"
echo "   - 所有專案、項目、變更記錄"
echo "   - 所有 QC 文件與審批記錄"
echo "   - 所有上傳檔案"
echo "   - 所有登入日誌"
echo ""
echo "✅ 將保留：所有使用者帳號與權限"
echo ""
read -p "確定要執行嗎？請輸入 'RESET' 確認: " confirm

if [ "$confirm" != "RESET" ]; then
    echo "已取消操作"
    exit 0
fi

echo ""
echo ">>> 步驟 1/3: 執行資料庫重置..."

# 檢測是否使用 Docker
if docker ps --format '{{.Names}}' | grep -q "rms-postgres"; then
    echo "    偵測到 Docker 環境，使用 docker exec..."
    docker exec -i rms-postgres psql -U rms_user -d rms_db < "$SCRIPT_DIR/reset-data.sql"
else
    echo "    使用本地 psql..."
    psql -U rms_user -d rms_db -f "$SCRIPT_DIR/reset-data.sql"
fi

echo ""
echo ">>> 步驟 2/3: 清除上傳檔案目錄..."

if [ -d "$UPLOADS_DIR" ]; then
    # 刪除所有子目錄和檔案，但保留 uploads 目錄本身
    find "$UPLOADS_DIR" -mindepth 1 -delete 2>/dev/null || true
    echo "    已清除 $UPLOADS_DIR"
else
    echo "    上傳目錄不存在，跳過"
fi

echo ""
echo ">>> 步驟 3/3: 重建目錄結構..."
mkdir -p "$UPLOADS_DIR"
echo "    已建立 $UPLOADS_DIR"

echo ""
echo "============================================"
echo "✅ 資料重置完成！"
echo "============================================"
echo ""
echo "你現在可以："
echo "  1. 登入系統 (使用現有帳號)"
echo "  2. 建立新專案"
echo ""
