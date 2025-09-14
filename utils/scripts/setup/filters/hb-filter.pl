#!/usr/bin/env perl
use strict; use warnings; binmode STDIN; binmode STDOUT;
my $W=$ENV{HB_FILTER_W}||3500; my $LOGF=$ENV{HB_FILTER_LOGF}||"";
my $PFX=$ENV{HB_FILTER_PFX}||"[HBWRAP"; my $SFX=$ENV{HB_FILTER_SFX}||"]";
my $BIN=$ENV{HB_FILTER_BIN}||"[HBBIN"; my $FLUSH=$ENV{HB_FILTER_FLUSH}||(4*$W);
my $logfh; if ($LOGF ne ""){ open($logfh,">>",$LOGF) or die $!; binmode $logfh; }
sub bad{ my($s)=@_; return ($s=~/[\x00-\x08\x0B\x0C\x0E-\x1A\x1C-\x1F\x7F]/)?1:0; }
sub chunks{ my($line,$nl)=@_; my $L=length($line); if($L<=$W){ print STDOUT $line,$nl; return; }
  my $n=int(($L+$W-1)/$W); my $start=0; for(my $i=1;$i<=$n;$i++){ my $end=$start+$W; $end=$L if $end>$L;
    my $chunk=substr($line,$start,$end-$start); my $a=$start+1; my $b=$end;
    print STDOUT "$PFX $i/$n $a..$b$SFX $chunk\n"; $start=$end; } print STDOUT $nl if $nl ne ""; }
sub soft{ my($r)=@_; my $buf=$$r; while(length($buf)>$FLUSH){ my $w=substr($buf,0,$W,"");
    print STDOUT "$PFX 1/1 1..".length($w)."$SFX $w\n"; } $$r=$buf; }
my $buf=""; while(1){ my $n=sysread(STDIN,my $c,8192); last if !defined($n)||$n==0; $buf.=$c; soft(\$buf);
  while($buf=~/[\r\n]/){ my $pn=index($buf,"\n"); $pn=1<<30 if $pn<0; my $pr=index($buf,"\r"); $pr=1<<30 if $pr<0;
    my $pos=($pn<$pr)?$pn:$pr; my $d=substr($buf,$pos,1); my $line=substr($buf,0,$pos);
    my $take=1; $take=2 if $d eq "\r" && substr($buf,$pos+1,1) eq "\n";
    my $raw=substr($buf,0,$pos+$take); $buf=substr($buf,$pos+$take); print $logfh $raw if $logfh;
    my $nl="\n"; if(bad($line)){ print STDOUT "$BIN suppressed ".length($line)." bytes$nl"; } else { chunks($line,$nl); } } }
if(length($buf)){ print $logfh $buf if $logfh; if(bad($buf)){ print STDOUT "$BIN suppressed ".length($buf)." bytes"; } else { chunks($buf,""); } }
