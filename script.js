// ============================================================================
// 1. FIREBASE SETUP & IMPORTY (Bez Storage)
// ============================================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { 
    getFirestore, collection, doc, getDoc, setDoc, addDoc, updateDoc, deleteDoc, onSnapshot, query, orderBy 
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// VÁŠ FIREBASE CONFIG
const firebaseConfig = {
  apiKey: "AIzaSyC6UgUDm9Q5G05NSYfwFreyAJ5Ff01keoU",
  authDomain: "nakup-seznam.firebaseapp.com",
  projectId: "nakup-seznam",
  storageBucket: "nakup-seznam.firebasestorage.app",
  messagingSenderId: "786304336238",
  appId: "1:786304336238:web:4789bafe6e762bb7a6417f"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ============================================================================
// 2. GLOBÁLNÍ PROMĚNNÉ A KATEGORIE
// ============================================================================
let currentListId = null;
let isShoppingMode = false;
let currentItems = [];
let unsubscribeSnapshot = null;

const CATEGORIES = {
    "1": "Ovoce a zelenina",
    "2": "Sypké výrobky",
    "3": "Konzervy",
    "4": "Pečivo",
    "5": "Maso",
    "6": "Mléčné výrobky",
    "7": "Sladkosti",
    "8": "Drogerie"
};

// ============================================================================
// 3. VÝBĚR UI ELEMENTŮ
// ============================================================================
const viewHome = document.getElementById('home-view');
const viewList = document.getElementById('list-view');
const viewShopping = document.getElementById('shopping-view');

const inputNewList = document.getElementById('new-list-name');
const btnAddList = document.getElementById('btn-add-list');
const containerSavedLists = document.getElementById('saved-lists');

const btnBackHome = document.getElementById('btn-back-home');
const currentListTitle = document.getElementById('current-list-title');
const btnStartShopping = document.getElementById('btn-start-shopping');
const containerItems = document.getElementById('items-container');

const btnAddItem = document.getElementById('btn-add-item');
const inputItemName = document.getElementById('item-name');
const inputItemCategory = document.getElementById('item-category');
const inputItemReceipt = document.getElementById('item-separate-receipt');
const inputItemSale = document.getElementById('item-only-sale');
const inputItemSalePrice = document.getElementById('item-sale-price'); // NOVÉ
const btnResetList = document.getElementById('btn-reset-list');

const btnEndShopping = document.getElementById('btn-end-shopping');
const containerToBuy = document.getElementById('shopping-to-buy');
const containerBought = document.getElementById('shopping-bought');
const containerMissing = document.getElementById('shopping-out-of-stock');

const modalEdit = document.getElementById('edit-modal');
const btnSaveEdit = document.getElementById('btn-save-edit');
const editItemId = document.getElementById('edit-item-id');
const editItemName = document.getElementById('edit-item-name');
const editItemCategory = document.getElementById('edit-item-category');
const editItemReceipt = document.getElementById('edit-item-separate-receipt');
const editItemSale = document.getElementById('edit-item-only-sale');
const editItemSalePrice = document.getElementById('edit-item-sale-price'); // NOVÉ

// ============================================================================
// 4. INICIALIZACE A LOCALSTORAGE
// ============================================================================
function init() {
    renderSavedLists();
    document.querySelectorAll('.close-modal, .modal-backdrop').forEach(el => {
        el.addEventListener('click', () => {
            modalEdit.classList.add('hidden');
        });
    });
}

function getSavedLists() {
    const lists = localStorage.getItem('shoppingLists');
    return lists ? JSON.parse(lists) : [];
}

function saveListLocally(listId) {
    let lists = getSavedLists();
    if (!lists.includes(listId)) {
        lists.push(listId);
        localStorage.setItem('shoppingLists', JSON.stringify(lists));
        renderSavedLists();
    }
}

// ============================================================================
// 5. NAVIGACE
// ============================================================================
function showView(viewId) {
    [viewHome, viewList, viewShopping].forEach(v => v.classList.remove('active', 'hidden'));
    [viewHome, viewList, viewShopping].forEach(v => {
        if (v.id === viewId) v.classList.add('active');
        else v.classList.add('hidden');
    });
}

// ============================================================================
// 6. FIREBASE LOGIKA
// ============================================================================
async function openOrCreateList(listId) {
    if (!listId.trim()) return alert("Zadejte název seznamu!");
    
    const formattedId = listId.trim().toLowerCase().replace(/\s+/g, '-');
    const listRef = doc(db, "lists", formattedId);
    
    try {
        const docSnap = await getDoc(listRef);
        if (!docSnap.exists()) {
            await setDoc(listRef, {
                createdAt: new Date(),
                name: listId
            });
        }
        
        saveListLocally(formattedId);
        currentListId = formattedId;
        currentListTitle.textContent = docSnap.exists() ? docSnap.data().name : listId;
        
        loadListItems();
        showView('list-view');
        inputNewList.value = "";
    } catch (error) {
        console.error("Chyba při otevírání seznamu:", error);
        alert("Nastala chyba při připojení k databázi.");
    }
}

function loadListItems() {
    if (unsubscribeSnapshot) unsubscribeSnapshot();
    
    const itemsRef = collection(db, `lists/${currentListId}/items`);
    const q = query(itemsRef, orderBy("category", "asc"));
    
    unsubscribeSnapshot = onSnapshot(q, (snapshot) => {
        currentItems = [];
        snapshot.forEach((doc) => {
            currentItems.push({ id: doc.id, ...doc.data() });
        });
        
        if (isShoppingMode) renderShoppingMode();
        else renderListMode();
    });
}

// ============================================================================
// 7. RENDEROVÁNÍ UI
// ============================================================================
function renderSavedLists() {
    containerSavedLists.innerHTML = "";
    const lists = getSavedLists();
    
    if (lists.length === 0) {
        containerSavedLists.innerHTML = "<p style='color: var(--text-muted);'>Zatím nemáte žádné uložené seznamy.</p>";
        return;
    }
    
    lists.forEach(list => {
        const btn = document.createElement('button');
        btn.className = 'list-button';
        btn.innerHTML = `<span>📝 ${list}</span> <span>➔</span>`;
        btn.onclick = () => openOrCreateList(list);
        containerSavedLists.appendChild(btn);
    });
}

function generateItemHTML(item, mode) {
    let badges = '';
    if (item.separateReceipt) badges += '<span class="badge receipt">Jiná účtenka</span>';
    
    // Zobrazení akce i s cenou
    if (item.sale) {
        const priceText = item.salePrice ? ` (${item.salePrice} Kč)` : '';
        badges += `<span class="badge sale">Akce${priceText}</span>`;
    }

    let actions = '';
    if (mode === 'list') {
        actions = `
            <div class="item-actions">
                <button class="btn-small" onclick="openEditModal('${item.id}')">✏️</button>
                <button class="btn-small" onclick="deleteItem('${item.id}')">🗑️</button>
            </div>
        `;
    } else if (mode === 'shopping') {
        if (item.status === 'to-buy') {
            // Tlačítka, když zboží ještě není koupené
            actions = `
                <div class="shopping-actions">
                    <button class="btn-small btn-buy" onclick="updateItemStatus('${item.id}', 'bought')">✔</button>
                    <button class="btn-small btn-miss" onclick="updateItemStatus('${item.id}', 'missing')">❌</button>
                </div>
            `;
        } else {
            // Tlačítko pro vrácení zpět do "Zbývá koupit" (pro Koupeno a Neměli)
            actions = `
                <div class="shopping-actions">
                    <button class="btn-small btn-return" onclick="updateItemStatus('${item.id}', 'to-buy')">↩ Vrátit</button>
                </div>
            `;
        }
    }

    return `
        <div class="item-row" id="item-${item.id}">
            <div class="item-info">
                <span class="item-name">${item.name}</span>
                <div class="item-badges">${badges}</div>
            </div>
            ${actions}
        </div>
    `;
}

function renderListMode() {
    containerItems.innerHTML = "";
    let currentCategory = null;

    currentItems.forEach(item => {
        if (item.category !== currentCategory) {
            currentCategory = item.category;
            containerItems.innerHTML += `<h3 class="category-header">${CATEGORIES[currentCategory]}</h3>`;
        }
        containerItems.innerHTML += generateItemHTML(item, 'list');
    });
}

function renderShoppingMode() {
    containerToBuy.innerHTML = "";
    containerBought.innerHTML = "";
    containerMissing.innerHTML = "";
    
    let toBuyHTML = "";
    let boughtHTML = "";
    let missingHTML = "";
    let currentCategoryToBuy = null;

    currentItems.forEach(item => {
        const html = generateItemHTML(item, 'shopping');
        
        if (item.status === 'bought') boughtHTML += html;
        else if (item.status === 'missing') missingHTML += html;
        else {
            if (item.category !== currentCategoryToBuy) {
                currentCategoryToBuy = item.category;
                toBuyHTML += `<h3 class="category-header">${CATEGORIES[currentCategoryToBuy]}</h3>`;
            }
            toBuyHTML += html;
        }
    });

    containerToBuy.innerHTML = toBuyHTML || "<p>Vše nakoupeno!</p>";
    containerBought.innerHTML = boughtHTML;
    containerMissing.innerHTML = missingHTML;
}

async function resetList() {
    console.log("Tlačítko Obnovit bylo stisknuto.");

    // Upravený text upozornění, aby odpovídal nové logice
    if (!confirm("Opravdu chcete vyčistit seznam? Smaže se vše 'Koupeno' a také prošlé akce z 'Neměli'. Ostatní běžné věci z 'Neměli' se vrátí do seznamu.")) return;

    if (!currentListId) {
        console.error("Chybí ID seznamu!");
        return;
    }

    btnResetList.disabled = true;
    btnResetList.textContent = "Čistím...";

    try {
        const promises = [];

        currentItems.forEach(item => {
            const itemRef = doc(db, `lists/${currentListId}/items`, item.id);

            if (item.status === 'bought') {
                // 1. Smazat VŠECHNY koupené věci
                console.log("Mažu koupené:", item.name);
                promises.push(deleteDoc(itemRef));
            } 
            else if (item.status === 'missing') {
                if (item.sale) {
                    // 2. Smazat věci z "Neměli", které BYLY v akci (akce už asi neplatí)
                    console.log("Mažu zmeškanou akci:", item.name);
                    promises.push(deleteDoc(itemRef));
                } else {
                    // 3. Vrátit zpět do nákupu věci z "Neměli", které NEBYLY v akci
                    console.log("Vracím zpět (není v akci):", item.name);
                    promises.push(updateDoc(itemRef, { status: 'to-buy' }));
                }
            }
        });

        await Promise.all(promises);
        console.log("Obnova seznamu dokončena.");
    } catch (error) {
        console.error("Chyba při resetu seznamu:", error);
        alert("Některé položky se nepodařilo aktualizovat. Podrobnosti v konzoli (F12).");
    } finally {
        btnResetList.disabled = false;
        btnResetList.textContent = "Obnovit";
    }
}

// ============================================================================
// 8. OBSLUHA AKCÍ
// ============================================================================
btnAddList.onclick = () => openOrCreateList(inputNewList.value);

btnBackHome.onclick = () => {
    if (unsubscribeSnapshot) unsubscribeSnapshot();
    currentListId = null;
    showView('home-view');
};

btnStartShopping.onclick = () => {
    isShoppingMode = true;
    showView('shopping-view');
    renderShoppingMode();
};

btnEndShopping.onclick = () => {
    isShoppingMode = false;
    showView('list-view');
    renderListMode();
};

btnResetList.onclick = resetList;


// Zobrazení/skrytí ceny při zaškrtnutí "V akci"
inputItemSale.addEventListener('change', (e) => {
    if (e.target.checked) {
        inputItemSalePrice.classList.remove('hidden');
    } else {
        inputItemSalePrice.classList.add('hidden');
        inputItemSalePrice.value = ''; // vymazat hodnotu
    }
});

editItemSale.addEventListener('change', (e) => {
    if (e.target.checked) {
        editItemSalePrice.classList.remove('hidden');
    } else {
        editItemSalePrice.classList.add('hidden');
        editItemSalePrice.value = '';
    }
});

btnAddItem.onclick = async () => {
    const name = inputItemName.value.trim();
    if (!name) return alert("Zadejte název položky");

    btnAddItem.disabled = true;
    btnAddItem.textContent = "Přidávám...";

    try {
        await addDoc(collection(db, `lists/${currentListId}/items`), {
            name: name,
            category: inputItemCategory.value,
            separateReceipt: inputItemReceipt.checked,
            sale: inputItemSale.checked,
            salePrice: inputItemSale.checked ? inputItemSalePrice.value : null,
            status: 'to-buy',
            createdAt: new Date()
        });
        
        // Reset formuláře
        inputItemName.value = "";
        inputItemReceipt.checked = false;
        inputItemSale.checked = false;
        inputItemSalePrice.value = "";
        inputItemSalePrice.classList.add('hidden');
    } catch (error) {
        console.error("Chyba přidání:", error);
    } finally {
        btnAddItem.disabled = false;
        btnAddItem.textContent = "Přidat položku";
    }
};

window.deleteItem = async (itemId) => {
    if (confirm("Opravdu smazat položku?")) {
        await deleteDoc(doc(db, `lists/${currentListId}/items`, itemId));
    }
};

window.updateItemStatus = async (itemId, newStatus) => {
    await updateDoc(doc(db, `lists/${currentListId}/items`, itemId), {
        status: newStatus
    });
};

window.openEditModal = (itemId) => {
    const item = currentItems.find(i => i.id === itemId);
    if (!item) return;

    editItemId.value = item.id;
    editItemName.value = item.name;
    editItemCategory.value = item.category;
    editItemReceipt.checked = item.separateReceipt;
    editItemSale.checked = item.sale;
    
    if (item.sale) {
        editItemSalePrice.classList.remove('hidden');
        editItemSalePrice.value = item.salePrice || '';
    } else {
        editItemSalePrice.classList.add('hidden');
        editItemSalePrice.value = '';
    }

    modalEdit.classList.remove('hidden');
};

btnSaveEdit.onclick = async () => {
    const id = editItemId.value;
    try {
        await updateDoc(doc(db, `lists/${currentListId}/items`, id), {
            name: editItemName.value,
            category: editItemCategory.value,
            separateReceipt: editItemReceipt.checked,
            sale: editItemSale.checked,
            salePrice: editItemSale.checked ? editItemSalePrice.value : null
        });
        modalEdit.classList.add('hidden');
    } catch (error) {
        console.error("Chyba úpravy:", error);
    }
};

document.addEventListener('DOMContentLoaded', init);

// ============================================================================
// 9. REGISTRACE SERVICE WORKERU (PWA)
// ============================================================================
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(registration => {
                console.log('ServiceWorker byl úspěšně zaregistrován s rozsahem: ', registration.scope);
            })
            .catch(err => {
                console.log('Registrace ServiceWorkeru selhala: ', err);
            });
    });
}