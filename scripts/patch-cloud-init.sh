#!/bin/sh

cat <<EOT > /tmp/patch-DataSourceRbxCloud.py.patch
diff --git a/cloudinit/sources/DataSourceRbxCloud.py b/cloudinit/sources/DataSourceRbxCloud.py
index 2fba1149..17946c46 100644
--- a/cloudinit/sources/DataSourceRbxCloud.py
+++ b/cloudinit/sources/DataSourceRbxCloud.py
@@ -161,7 +161,7 @@ def read_user_data_callback(mount_dir):
     if "vm" not in meta_data or "netadp" not in meta_data:
         util.logexc(LOG, "Failed to load metadata. Invalid format.")
         return None
-    username = meta_data.get("additionalMetadata", {}).get("username")
+    username = meta_data.get("additionalMetadata", {}).get("username", "guru")
     ssh_keys = meta_data.get("additionalMetadata", {}).get("sshKeys", [])
 
     hash = None
EOT

FILE=$(find /usr/lib/python* -name "DataSourceRbxCloud.py")

if [ -e "$FILE" ]; then
  patch $FILE < /tmp/patch-DataSourceRbxCloud.py.patch
  exit 0
fi

echo "File DataSourceRbxCloud.py to patch NOT found"
exit 1
