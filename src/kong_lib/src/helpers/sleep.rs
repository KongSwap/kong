use std::time::Duration;

pub async fn async_sleep(timeout: Duration) {
    let (sender, receiver) = futures::channel::oneshot::channel();
    ic_cdk_timers::set_timer(timeout, move || {
        let _ = sender.send(());
    });
    let _ = receiver.await;
}

pub async fn periodic_poller<F, T, E>(poll_fn: F, timeout: Duration, check_period: Duration) -> Result<T, E>
where
    F: Fn() -> Result<T, E>,
{
    let mut timeout = timeout;
    let mut check_period = check_period;

    loop {
        match poll_fn() {
            Ok(v) => return Ok(v),
            Err(e) => {
                if timeout.is_zero() {
                    return Err(e);
                }
            }
        }

        (timeout, check_period) = if timeout >= check_period {
            (timeout - check_period, check_period)
        } else {
            (Duration::default(), timeout)
        };

        async_sleep(check_period).await;
        continue; // Retry sender extraction
    }
}
