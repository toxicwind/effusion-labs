exec 1>var/exec_probe/fd_demo.out.txt
exec 2>var/exec_probe/fd_demo.err.txt
echo INSIDE_DEMO_OUT
echo INSIDE_DEMO_ERR >&2
