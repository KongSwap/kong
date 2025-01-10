use crate::stable_memory::{with_memory, with_memory_mut, EVENT_STORE_EVENTS_MEMORY_ID};
use candid::Principal;
use event_store_producer::{Event, EventStoreClient, EventStoreClientBuilder};
use event_store_producer_cdk_runtime::CdkRuntime;
use ic_stable_structures::reader::{BufferedReader, Reader};
use ic_stable_structures::writer::{BufferedWriter, Writer};
use std::cell::RefCell;

const ONE_MB: usize = 1024 * 1024;

thread_local! {
    static EVENT_STORE_CLIENT: RefCell<Option<EventStoreClient<CdkRuntime>>> = RefCell::default();
}

pub fn init(event_store_client: EventStoreClient<CdkRuntime>) {
    EVENT_STORE_CLIENT.set(Some(event_store_client));
}

pub fn default(event_store_canister_id: Principal) -> EventStoreClient<CdkRuntime> {
    EventStoreClientBuilder::new(event_store_canister_id, CdkRuntime::default()).build()
}

pub fn push_event(event: Event) {
    EVENT_STORE_CLIENT.with_borrow_mut(|client| {
        if let Some(client) = client {
            client.push(event);
        }
    });
}

pub fn save_to_stable_memory() {
    if let Some(client) = EVENT_STORE_CLIENT.take() {
        with_memory_mut(EVENT_STORE_EVENTS_MEMORY_ID, |memory| {
            let writer = BufferedWriter::new(ONE_MB, Writer::new(memory, 0));
            _ = serde_cbor::to_writer(writer, &client);
        });
    }
}

pub fn load_from_stable_memory() -> bool {
    with_memory(EVENT_STORE_EVENTS_MEMORY_ID, |memory| {
        let reader = BufferedReader::new(ONE_MB, Reader::new(memory, 0));
        match serde_cbor::from_reader(reader) {
            Ok(client) => {
                init(client);
                true
            }
            Err(_) => false,
        }
    })
}
