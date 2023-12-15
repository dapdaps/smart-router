#!/usr/bin/env bash

basedir=$(cd "$(dirname "$0")"; pwd)
cd ${basedir}

function getpid() {
  # pid=`pstree -ap|grep uvicorn| grep -v grep| head -n 1| awk -F ',' '{print $2}'| awk '{print $1}'`
  pid=`netstat -ntlp|grep 9101|awk '{printf $7}'|cut -d/ -f1`
}


function start(){
    getpid;
    if [[ ! -z $pid ]];then
        echo "服务已运行中,pid:" $pid
        exit 1;
    fi
    cpu=`cat /proc/cpuinfo| grep "processor"| wc -l`
    ts=`expr $cpu \* 2`
    nohup npm run start  > web.out 2> web.err < /dev/null &
 }

function stop(){
    getpid;
    if [[ ! -z $pid ]];then
        echo "停止服务,pid:" $pid
    else
      echo "服务未启动,无需停止."
      exit 1;
    fi
    kill -9 $pid
}

function restart(){
    getpid;
    if [[ ! -z $pid ]];then
        echo "服务已运行中,pid:" $pid
            kill -9 $pid
        getpid;
        while [[ ! -z $pid ]]
        do
           sleep 1;
               getpid;
        done
    else
      echo "服务未启动,无需停止."
    fi
    start;

}

function status(){
    getpid;
    if [[ ! -z $pid ]];then
        echo "服务运行中,pid:" $pid
    else
        echo "服务未启动."
        exit 1;
    fi
}

function usage(){
    echo "$0 <start|stop|restart|status>"
}

case $1 in
    start)
       start;
       ;;
    stop)
       stop;
       ;;
    restart)
       restart;
       ;;
    status)
        status;
        ;;
    *)
       usage;
       ;;
esac
