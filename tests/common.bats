#!/usr/bin/env bats

@test "check image disks count" {

 vm_disks_count=$(${RBX_CLI} vm disk list --vm "$VM_ID" --query 'length([])' -o json)
 image_disks_count=$(${RBX_CLI} image show --image "$IMAGE_ID" --query 'length([].disks)' -o json)
 
 [ "$vm_disks_count" == "$image_disks_count" ]

}
