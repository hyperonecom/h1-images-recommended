#!/usr/bin/env bats

@test "check image disks count" {

 vm_disks_count=$(${RBX_CLI} storage disk list --vm "$VM_ID" --query 'length([])')
 image_disks_count=$(${RBX_CLI} storage image show --image "$IMAGE_ID" --query 'length([])')
 
 [ "$vm_disks_count" == "$image_disks_count" ]

}
