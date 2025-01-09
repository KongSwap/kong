use super::stable_user::StableUser;

use crate::stable_memory::{PRINCIPAL_ID_MAP, USER_MAP};

pub fn create_principal_id_map() {
    USER_MAP.with(|m| {
        let user_map = m.borrow();
        user_map.iter().for_each(|(_, user)| insert_principal_id(&user));
    });
}

pub fn get_user_id(principal_id: &str) -> Option<u32> {
    PRINCIPAL_ID_MAP.with(|m| m.borrow().get(principal_id).copied())
}

pub fn insert_principal_id(user: &StableUser) {
    PRINCIPAL_ID_MAP.with(|m| {
        let mut principal_id_map = m.borrow_mut();
        principal_id_map.insert(user.principal_id.clone(), user.user_id);
    });
}
