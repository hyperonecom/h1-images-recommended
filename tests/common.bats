#!/usr/bin/env bats

@test "check image disks count" {

 vm_disks_count=$(h1 vm disk list --vm "$VM_ID" --query 'length([])' -o json)
 image_disks_count=$( h1 image show --image "$IMAGE_ID" --query 'length([].disks)' -o json)
 
 [ "$vm_disks_count" == "$image_disks_count" ]

}
