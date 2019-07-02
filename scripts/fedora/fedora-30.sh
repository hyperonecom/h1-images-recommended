# Update cloud-init version to 18.5
# See:
# - https://bugzilla.redhat.com/show_bug.cgi?id=1661441
# - https://git.launchpad.net/cloud-init/commit/?id=3861102fcaf47a882516d8b6daab518308eb3086
# - https://src.fedoraproject.org/rpms/cloud-init/pull-request/3
#curl http://cdn.files.jawne.info.pl/private_html/2019_03_ai7iephohzuph5bai1kefuwap2iequisheengungooCieD6loh/cloud-init-18.5-1.fc29.noarch.rpm -o /tmp/cloud-init-18.5-1.fc29.noarch.rpm
#yum localinstall -y /tmp/cloud-init-18.5-1.fc29.noarch.rpm
yum install -y network-scripts