COUNT=5
RDP_PORT="3389"

for i in {1..$COUNT}; do
   nc -z $vm_ip $RDP_PORT || echo "No connection yet.. Still waiting"
   sleep $WAIT
done
