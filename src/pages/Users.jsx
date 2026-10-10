import FilterDropdown from "../components/FilterDropdown";
import {
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";

import {
    useNavigate,
    useParams,
} from "react-router-dom";

import {
    usersSeed,
    stores,
    merchantStores,
} from "../data/data";

import "../styles/users.css";
import Pagination from "../components/Pagination";
import ViewDetailsModal from "../components/ViewDetailsModal";


/* =========================================================
   ROLES
========================================================= */

const USER_ROLES = [
    "Merchant",
    "Manager",
    "Cashier",
    "Shopkeeper",
    "Super-visor",
];


/* =========================================================
   EMPTY FORM
========================================================= */

const EMPTY_FORM = {
    username: "",
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    role: "",
    loginPin: "",
    profilePhoto: "",
};


/* =========================================================
   USERS
========================================================= */

export default function Users({
    embedded = false,
    merchantId: merchantIdProp,
    storeId: storeIdProp,
    store: storeProp,
}) {
    const navigate = useNavigate();
    const params = useParams();


    /* =====================================================
       ROUTE CONTEXT
    ===================================================== */

    const merchantId =
        merchantIdProp ||
        storeProp?.merchantId ||
        params.merchantId ||
        "";

    const storeId =
        storeIdProp ||
        storeProp?.id ||
        params.storeId ||
        "";


    /* =====================================================
       CURRENT STORE

       Priority:
       1. Store passed from StoreConfiguration
       2. merchantStores
       3. global stores
    ===================================================== */

    const currentStore = useMemo(() => {

        /* -------------------------------------------------
           StoreConfiguration already provides the store
        ------------------------------------------------- */

        if (storeProp) {
            return storeProp;
        }


        /* -------------------------------------------------
           Merchant → Store
        ------------------------------------------------- */

        if (
            merchantId &&
            merchantStores?.[merchantId]
        ) {
            const merchantStore =
                merchantStores[merchantId].find(
                    (item) =>
                        String(item.id) ===
                        String(storeId)
                );

            if (merchantStore) {
                return merchantStore;
            }
        }


        /* -------------------------------------------------
           Global Stores
        ------------------------------------------------- */

        if (storeId) {
            const globalStore =
                stores.find(
                    (item) =>
                        String(item.id) ===
                        String(storeId)
                );

            if (globalStore) {
                return globalStore;
            }
        }


        return null;

    }, [
        merchantId,
        storeId,
        storeProp,
    ]);


    /* =====================================================
       USERS

       For now usersSeed is used because the
       Users API is still in progress.
    ===================================================== */

    const [list, setList] = useState(() => {
        return Array.isArray(usersSeed)
            ? usersSeed
            : [];
    });


    /* =====================================================
       EDIT STATE
    ===================================================== */

    const [editing, setEditing] =
        useState(null);


    /* =====================================================
       VIEW STATE
    ===================================================== */

    const [selectedUser, setSelectedUser] =
        useState(null);


    /* =====================================================
       SEARCH
    ===================================================== */

    const [q, setQ] =
        useState("");


    /* =====================================================
       ROLE FILTER
    ===================================================== */

    const [roleFilter, setRoleFilter] =
        useState("");


    /* =====================================================
       PAGINATION
    ===================================================== */

    const [currentPage, setCurrentPage] =
        useState(1);

    const [pageSize, setPageSize] =
        useState(10);


    /* =====================================================
       FORM
    ===================================================== */

    const [form, setForm] =
        useState(EMPTY_FORM);


    /* =====================================================
       PIN VISIBILITY
    ===================================================== */




    /* =====================================================
       PHOTO REF
    ===================================================== */

    const photo =
        useRef(null);


    /* =========================================================
       GET STORE ROLE ASSIGNMENT
    ========================================================= */

    const getStoreAssignment = (user) => {

        if (!user) {
            return null;
        }


        /* -------------------------------------------------
           New employee structure
        ------------------------------------------------- */

        if (
            Array.isArray(
                user.storeRoleAssignments
            )
        ) {
            return (
                user.storeRoleAssignments.find(
                    (assignment) =>
                        String(
                            assignment.storeId
                        ) ===
                        String(storeId)
                ) || null
            );
        }


        /* -------------------------------------------------
           Legacy single-store structure
        ------------------------------------------------- */

        if (
            user.storeId &&
            String(user.storeId) ===
            String(storeId)
        ) {
            return {
                storeId:
                    user.storeId,

                storeName:
                    user.storeName,

                role:
                    user.role,
            };
        }


        return null;
    };


    /* =========================================================
       USERS FOR SELECTED STORE
    ========================================================= */

    const storeUsers = useMemo(() => {

        /*
         * Users page is store-specific.
         *
         * If no store has been selected,
         * don't display employee records.
         */

        if (!storeId) {
            return [];
        }


        return list.filter((user) => {
            return (
                getStoreAssignment(user) !==
                null
            );
        });

    }, [
        list,
        storeId,
    ]);


    /* =========================================================
       SEARCH + ROLE FILTER
    ========================================================= */

    const filteredUsers = useMemo(() => {

        return storeUsers.filter(
            (user) => {

                const assignment =
                    getStoreAssignment(
                        user
                    );

                const role =
                    assignment?.role ||
                    "";

                const searchText = [
                    user.username,
                    user.firstName,
                    user.lastName,
                    user.email,
                    user.phone,
                    role,
                ]
                    .filter(Boolean)
                    .join(" ")
                    .toLowerCase();

                const matchesSearch =
                    !q ||
                    searchText.includes(
                        q.toLowerCase()
                    );

                const matchesRole =
                    !roleFilter ||
                    role === roleFilter;

                return (
                    matchesSearch &&
                    matchesRole
                );
            }
        );

    }, [
        storeUsers,
        q,
        roleFilter,
        storeId,
    ]);


    /* =========================================================
       PAGINATION LOGIC
    ========================================================= */

    const totalItems =
        filteredUsers.length;

    const totalPages =
        Math.ceil(
            totalItems / pageSize
        );

    const paginatedUsers =
        filteredUsers.slice(
            (currentPage - 1) * pageSize,
            currentPage * pageSize
        );


    /* =========================================================
       RESET PAGINATION

       When search, role filter or store changes,
       always start from page 1.
    ========================================================= */

    useEffect(() => {
        setCurrentPage(1);
    }, [
        q,
        roleFilter,
        storeId,
    ]);


    /* =========================================================
       KEEP PAGE VALID

       Example:
       Page 3 has 10 records.
       User changes filter and now only
       1 page remains.
    ========================================================= */

    useEffect(() => {

        if (
            totalPages > 0 &&
            currentPage > totalPages
        ) {
            setCurrentPage(
                totalPages
            );
        }

    }, [
        currentPage,
        totalPages,
    ]);


    /* =========================================================
       START EDIT
    ========================================================= */

    const startEdit = (user) => {

        const assignment =
            getStoreAssignment(
                user
            );

        if (!assignment) {
            return;
        }


        setEditing(user.id);

        setForm({
            username:
                user.username || "",

            firstName:
                user.firstName || "",

            lastName:
                user.lastName || "",

            email:
                user.email || "",

            phone:
                user.phone || "",

            role:
                assignment.role ||
                user.role ||
                "",

            loginPin:
                "",

            profilePhoto:
                user.profilePhoto ||
                "",
        });
    };


    /* =========================================================
       CANCEL EDIT
    ========================================================= */

    const cancelEdit = () => {

        setEditing(null);

        setForm(
            EMPTY_FORM
        );
    };


    /* =========================================================
       FORM SETTER
    ========================================================= */

    const set = (
        key,
        value
    ) => {

        setForm(
            (previous) => ({
                ...previous,
                [key]: value,
            })
        );
    };


    /* =========================================================
       PROFILE PHOTO
    ========================================================= */

    const handlePhotoChange = (
        event
    ) => {

        const file =
            event.target
                .files?.[0];

        if (!file) {
            return;
        }


        const allowedTypes = [
            "image/jpeg",
            "image/png",
            "image/webp",
        ];

        if (
            !allowedTypes.includes(
                file.type
            )
        ) {
            alert(
                "Please select a JPG, PNG or WEBP image."
            );

            event.target.value =
                "";

            return;
        }


        if (
            file.size >
            2 *
                1024 *
                1024
        ) {
            alert(
                "Profile photo must be smaller than 2 MB."
            );

            event.target.value =
                "";

            return;
        }


        const imageUrl =
            URL.createObjectURL(
                file
            );

        set(
            "profilePhoto",
            imageUrl
        );
    };


    /* =========================================================
       SAVE EDIT
    ========================================================= */

    const save = (
        event
    ) => {

        event.preventDefault();

        if (!editing) {
            return;
        }


        /* -------------------------------------------------
           Required fields
        ------------------------------------------------- */

        if (
            !form.username.trim() ||
            !form.firstName.trim() ||
            !form.lastName.trim() ||
            !form.email.trim() ||
            !form.role
        ) {
            alert(
                "Please complete all required fields."
            );

            return;
        }


        /* -------------------------------------------------
           Profile photo mandatory
        ------------------------------------------------- */

        if (!form.profilePhoto) {
            alert(
                "Profile photo is mandatory."
            );

            return;
        }


        /* -------------------------------------------------
           Validate PIN only when entered
        ------------------------------------------------- */

        if (
            form.loginPin &&
            !/^\d{6}$/.test(
                form.loginPin
            )
        ) {
            alert(
                "Login PIN must contain exactly 6 digits."
            );

            return;
        }


        /* -------------------------------------------------
           Update employee
        ------------------------------------------------- */

        const updatedList =
            list.map(
                (user) => {

                    if (
                        String(
                            user.id
                        ) !==
                        String(
                            editing
                        )
                    ) {
                        return user;
                    }


                    /* -------------------------------------
                       Copy existing assignments
                    ------------------------------------- */

                    let assignments =
                        Array.isArray(
                            user.storeRoleAssignments
                        )
                            ? [
                                  ...user.storeRoleAssignments,
                              ]
                            : [];


                    /* -------------------------------------
                       Legacy user support
                    ------------------------------------- */

                    if (
                        assignments.length ===
                            0 &&
                        user.storeId
                    ) {
                        assignments = [
                            {
                                storeId:
                                    user.storeId,

                                storeName:
                                    user.storeName,

                                role:
                                    user.role,
                            },
                        ];
                    }


                    /* -------------------------------------
                       Find selected store assignment
                    ------------------------------------- */

                    const assignmentIndex =
                        assignments.findIndex(
                            (
                                assignment
                            ) =>
                                String(
                                    assignment.storeId
                                ) ===
                                String(
                                    storeId
                                )
                        );


                    /* -------------------------------------
                       Change ONLY selected store role
                    ------------------------------------- */

                    if (
                        assignmentIndex !==
                        -1
                    ) {
                        assignments[
                            assignmentIndex
                        ] = {
                            ...assignments[
                                assignmentIndex
                            ],

                            role:
                                form.role,
                        };
                    }


                    /* -------------------------------------
                       Updated employee
                    ------------------------------------- */

                    const updatedUser =
                        {
                            ...user,

                            username:
                                form.username.trim(),

                            firstName:
                                form.firstName.trim(),

                            lastName:
                                form.lastName.trim(),

                            email:
                                form.email.trim(),

                            phone:
                                form.phone.trim(),

                            profilePhoto:
                                form.profilePhoto,

                            storeRoleAssignments:
                                assignments,

                            /*
                             * Legacy fields retained
                             * for compatibility.
                             */

                            storeId:
                                storeId,

                            storeName:
                                currentStore?.name ||
                                user.storeName,

                            role:
                                form.role,

                            merchantId:
                                user.merchantId ||
                                merchantId,

                            merchantName:
                                user.merchantName,

                            status:
                                user.status ||
                                "Active",
                        };


                    /* -------------------------------------
                       Updated PIN only if entered
                    ------------------------------------- */

                    if (
                        form.loginPin
                    ) {
                        updatedUser.loginPin =
                            form.loginPin;
                    }


                    return updatedUser;
                }
            );


        /* -------------------------------------------------
           Update state
        ------------------------------------------------- */

        setList(
            updatedList
        );

        /*
         * Demo:
         * edits live in React state and reset
         * when this page remounts.
         */


        /* -------------------------------------------------
           Close edit
        ------------------------------------------------- */

        setEditing(null);

        setForm(
            EMPTY_FORM
        );

        alert(
            "User updated successfully."
        );
    };


    /* =========================================================
       VIEW USER DETAILS
    ========================================================= */

    const userDetailsFields = [
        {
            label: "Profile Photo",
            key: "profilePhoto",
            fullWidth: true,

            render: (value) =>
                value ? (
                    <img
                        src={value}
                        alt="User profile"
                        className="view-details-image"
                    />
                ) : (
                    <span>—</span>
                ),
        },

        {
            label: "Username",
            key: "username",
        },

        {
            label: "First Name",
            key: "firstName",
        },

        {
            label: "Last Name",
            key: "lastName",
        },

        {
            label: "Email",
            key: "email",
        },

        {
            label: "Phone",
            key: "phone",
        },

        {
            label: "Status",
            key: "status",

            render: (value) => {
                const status =
                    value ||
                    "Active";

                const statusClass =
                    String(
                        status
                    )
                        .toLowerCase()
                        .replace(
                            /\s+/g,
                            "-"
                        );

                return (
                    <span
                        className={`detail-status ${statusClass}`}
                    >
                        {status}
                    </span>
                );
            },
        },

        {
            label: "Merchant",
            key: "merchantName",
        },

        {
            label: "Store",

            value: (user) =>
                getStoreAssignment(
                    user
                )?.storeName ||
                user.storeName ||
                currentStore?.name ||
                "—",
        },

        {
            label: "Store ID",

            value: (user) =>
                getStoreAssignment(
                    user
                )?.storeId ||
                user.storeId ||
                storeId ||
                "—",
        },

        {
            label: "Role",

            value: (user) =>
                getStoreAssignment(
                    user
                )?.role ||
                user.role ||
                "—",
        },

        {
            label: "Login PIN",

            render: () => (
                <span>
                    ••••••
                </span>
            ),
        },

        {
            label: "Store Assignments",
            key: "storeRoleAssignments",
            fullWidth: true,

            render: (
                assignments
            ) => {

                /*
                 * New multi-store structure
                 */

                if (
                    Array.isArray(
                        assignments
                    ) &&
                    assignments.length >
                        0
                ) {
                    return (
                        <div className="view-details-list">

                            {assignments.map(
                                (
                                    assignment,
                                    index
                                ) => (
                                    <div
                                        key={`${assignment.storeId || "store"}-${index}`}
                                        className="view-details-list-item"
                                    >

                                        <div>

                                            <strong>
                                                {
                                                    assignment.storeName ||
                                                    assignment.storeId ||
                                                    "Store"
                                                }
                                            </strong>

                                            {assignment.storeId && (
                                                <small>
                                                    {
                                                        assignment.storeId
                                                    }
                                                </small>
                                            )}

                                        </div>

                                        <span className="detail-status active">
                                            {
                                                assignment.role ||
                                                "—"
                                            }
                                        </span>

                                    </div>
                                )
                            )}

                        </div>
                    );
                }


                /*
                 * Legacy single-store structure
                 */

                if (
                    selectedUser?.storeId
                ) {
                    return (
                        <div className="view-details-list">

                            <div className="view-details-list-item">

                                <div>

                                    <strong>
                                        {
                                            selectedUser.storeName ||
                                            currentStore?.name ||
                                            "Store"
                                        }
                                    </strong>

                                    <small>
                                        {
                                            selectedUser.storeId
                                        }
                                    </small>

                                </div>

                                <span className="detail-status active">
                                    {
                                        selectedUser.role ||
                                        "—"
                                    }
                                </span>

                            </div>

                        </div>
                    );
                }


                return (
                    <span>
                        —
                    </span>
                );
            },
        },
    ];


    /* =========================================================
       EDIT SCREEN
    ========================================================= */

    if (editing) {
        return (
            <UserEditForm
                form={form}
                set={set}
                onSubmit={save}
                onCancel={
                    cancelEdit
                }
                photo={photo}
                onPhotoChange={
                    handlePhotoChange
                }
                currentStore={
                    currentStore
                }
            />
        );
    }


    /* =========================================================
       USERS LIST
    ========================================================= */

    return (
        <div
            className={`page-content users-page ${
                embedded
                    ? "users-page-embedded"
                    : ""
            }`}
        >

            <section>

                {/* =================================================
                   HEADER
                ================================================= */}

                <div className="page-header users-header">

                    <div>

                        {!embedded && (
                            <div className="breadcrumb-area">

                                <button
                                    type="button"
                                    className="link-button"
                                    onClick={() =>
                                        navigate(
                                            merchantId
                                                ? `/merchants/${merchantId}/stores`
                                                : "/stores"
                                        )
                                    }
                                >
                                    <i className="bi bi-arrow-left" />

                                    Stores
                                </button>

                                <span>
                                    /
                                </span>

                                <span>
                                    Users
                                </span>

                            </div>
                        )}

                        <h1>
                            Users
                        </h1>

                        <p>
                            View and edit users
                            assigned to this
                            store.
                        </p>

                    </div>

                </div>


                {/* =================================================
                   STORE CARD

                   Only show in standalone Users page.

                   StoreConfiguration already has the
                   selected store card when embedded.
                ================================================= */}

                {!embedded &&
                    currentStore && (
                        <div className="selected-store-card">

                            <div className="selected-store-main">

                                <div className="selected-store-icon">
                                    <i className="bi bi-shop" />
                                </div>

                                <div className="selected-store-info">

                                    <h3>
                                        {
                                            currentStore.name
                                        }
                                    </h3>

                                    <div className="selected-store-meta">

                                        <span>
                                            Store ID:{" "}
                                            {
                                                currentStore.id
                                            }
                                        </span>

                                        <span className="meta-dot">
                                            •
                                        </span>

                                        <span>
                                            {
                                                currentStore.type ||
                                                "Retail Store"
                                            }
                                        </span>

                                        <span className="meta-dot">
                                            •
                                        </span>

                                        <span>
                                            {
                                                currentStore.location ||
                                                "—"
                                            }
                                        </span>

                                    </div>

                                </div>

                            </div>

                            <div className="selected-store-status">

                                <span className="status-title">
                                    Status
                                </span>

                                <span className="store-active-badge">
                                    {
                                        currentStore.status ||
                                        "Active"
                                    }
                                </span>

                            </div>

                        </div>
                    )}


                {/* =================================================
                   TOOLBAR
                ================================================= */}

                <div className="users-toolbar">

                    <div className="users-toolbar-left">

                        <div className="user-search">

                            <i className="bi bi-search" />

                            <input
                                type="text"
                                placeholder="Search users..."
                                value={q}
                                onChange={(
                                    event
                                ) =>
                                    setQ(
                                        event
                                            .target
                                            .value
                                    )
                                }
                            />

                        </div>

                    </div>

                    <FilterDropdown
                        className="role-filter"
                        value={
                            roleFilter
                        }
                        onChange={(
                            event
                        ) =>
                            setRoleFilter(
                                event
                                    .target
                                    .value
                            )
                        }
                    >

                        <option value="">
                            All Roles
                        </option>

                        {USER_ROLES.map(
                            (
                                role
                            ) => (
                                <option
                                    key={
                                        role
                                    }
                                    value={
                                        role
                                    }
                                >
                                    {
                                        role
                                    }
                                </option>
                            )
                        )}

                    </FilterDropdown>

                </div>


                {/* =================================================
                   TABLE
                ================================================= */}

                <div className="users-table-card">

                    <div className="table-wrapper">

                        <table className="users-table">

                            <thead>

                                <tr>

                                    <th>
                                        User
                                    </th>

                                    <th>
                                        Name
                                    </th>

                                    <th>
                                        Role
                                    </th>

                                    <th>
                                        Email
                                    </th>

                                    <th>
                                        Phone
                                    </th>

                                    <th>
                                        Status
                                    </th>

                                    <th>
                                        Action
                                    </th>

                                </tr>

                            </thead>


                            <tbody>

                                {paginatedUsers.map(
                                    (
                                        user
                                    ) => {

                                        const assignment =
                                            getStoreAssignment(
                                                user
                                            );

                                        const role =
                                            assignment?.role ||
                                            "—";

                                        const initials =
                                            `${user.firstName?.[0] || ""}${user.lastName?.[0] || ""}`
                                                .toUpperCase();

                                        return (
                                            <tr
                                                key={
                                                    user.id
                                                }
                                            >

                                                {/* USER */}

                                                <td>

                                                    <div className="user-cell">

                                                        <div className="user-avatar">

                                                            {user.profilePhoto ? (
                                                                <img
                                                                    src={
                                                                        user.profilePhoto
                                                                    }
                                                                    alt={`${user.firstName || ""} ${user.lastName || ""}`}
                                                                />
                                                            ) : (
                                                                initials ||
                                                                <i className="bi bi-person" />
                                                            )}

                                                        </div>

                                                        <span className="user-username">
                                                            {
                                                                user.username
                                                            }
                                                        </span>

                                                    </div>

                                                </td>


                                                {/* NAME */}

                                                <td>
                                                    {
                                                        user.firstName
                                                    }{" "}
                                                    {
                                                        user.lastName
                                                    }
                                                </td>


                                                {/* ROLE */}

                                                <td>

                                                    <span className="role-badge">
                                                        {
                                                            role
                                                        }
                                                    </span>

                                                </td>


                                                {/* EMAIL */}

                                                <td>
                                                    {
                                                        user.email
                                                    }
                                                </td>


                                                {/* PHONE */}

                                                <td>
                                                    {
                                                        user.phone ||
                                                        "—"
                                                    }
                                                </td>


                                                {/* STATUS */}

                                                <td>

                                                    <span className="status-badge">

                                                        <span className="status-dot" />

                                                        {
                                                            user.status ||
                                                            "Active"
                                                        }

                                                    </span>

                                                </td>


                                                {/* ACTION */}

                                                <td>

                                                    <div className="table-actions">

                                                        {/* VIEW */}

                                                        <button
                                                            type="button"
                                                            className="table-action"
                                                            title="View User"
                                                            onClick={() =>
                                                                setSelectedUser(
                                                                    user
                                                                )
                                                            }
                                                        >
                                                            <i className="bi bi-eye" />
                                                        </button>


                                                        {/* EDIT */}

                                                        <button
                                                            type="button"
                                                            className="table-action"
                                                            title="Edit User"
                                                            onClick={() =>
                                                                startEdit(
                                                                    user
                                                                )
                                                            }
                                                        >
                                                            <i className="bi bi-pencil" />
                                                        </button>

                                                    </div>

                                                </td>

                                            </tr>
                                        );
                                    }
                                )}

                            </tbody>

                        </table>

                    </div>


                    {/* =================================================
                       EMPTY STATE
                    ================================================= */}

                    {filteredUsers.length ===
                        0 && (
                        <div className="empty-users">

                            <div className="empty-icon">
                                <i className="bi bi-people" />
                            </div>

                            <h3>
                                No users found
                            </h3>

                            <p>
                                {!storeId
                                    ? "No store selected. Pass storeId or store, or use a route with :storeId."
                                    : storeUsers.length ===
                                      0
                                        ? `No employees are assigned to store ${storeId}.`
                                        : "No users match the search or role filter."}
                            </p>

                        </div>
                    )}


                    {/* =================================================
                       PAGINATION
                    ================================================= */}

                    {totalItems > 0 && (
                        <Pagination
                            currentPage={
                                currentPage
                            }
                            totalPages={
                                totalPages
                            }
                            totalItems={
                                totalItems
                            }
                            pageSize={
                                pageSize
                            }
                            onPageChange={
                                setCurrentPage
                            }
                            onPageSizeChange={(
                                size
                            ) => {
                                setPageSize(
                                    size
                                );

                                setCurrentPage(
                                    1
                                );
                            }}
                        />
                    )}

                </div>


                {/* =================================================
                   VIEW DETAILS MODAL
                ================================================= */}

                <ViewDetailsModal
                    open={
                        Boolean(
                            selectedUser
                        )
                    }
                    title="User Details"
                    subtitle={
                        selectedUser?.username
                            ? `Username: ${selectedUser.username}`
                            : ""
                    }
                    data={
                        selectedUser
                    }
                    fields={
                        userDetailsFields
                    }
                    onClose={() =>
                        setSelectedUser(
                            null
                        )
                    }
                />

            </section>

        </div>
    );
}


/* =========================================================
   EDIT FORM
========================================================= */

function UserEditForm({
    form,
    set,
    onSubmit,
    onCancel,
    photo,
    onPhotoChange,
    currentStore,
}) {

    return (
        <div className="page-content users-page">

            {/* =================================================
               HEADER
            ================================================= */}

            <div className="page-header users-header">

                <div>

                    <div className="breadcrumb-area">

                        <button
                            type="button"
                            className="link-button"
                            onClick={
                                onCancel
                            }
                        >
                            <i className="bi bi-arrow-left" />

                            Users
                        </button>

                        <span>
                            /
                        </span>

                        <span>
                            Edit User
                        </span>

                    </div>

                    <h1>
                        Edit User
                    </h1>

                    <p>
                        Update user details,
                        role, PIN and profile
                        photo.
                    </p>

                </div>

            </div>


            {/* =================================================
               FORM
            ================================================= */}

            <form
                className="user-form"
                onSubmit={
                    onSubmit
                }
            >

                {/* =================================================
                   USER INFORMATION
                ================================================= */}

                <Card
                    icon="person"
                    color="purple"
                    title="User Information"
                    sub="Update the user's personal and account details."
                >

                    <div className="form-grid two-columns">

                        <Field
                            label="Username"
                            value={
                                form.username
                            }
                            placeholder="Enter username"
                            required
                            onChange={(
                                value
                            ) =>
                                set(
                                    "username",
                                    value
                                )
                            }
                        />

                        <Select
                            label="Role"
                            value={
                                form.role
                            }
                            set={(
                                value
                            ) =>
                                set(
                                    "role",
                                    value
                                )
                            }
                            options={
                                USER_ROLES
                            }
                        />

                        <Field
                            label="First Name"
                            value={
                                form.firstName
                            }
                            placeholder="Enter first name"
                            required
                            onChange={(
                                value
                            ) =>
                                set(
                                    "firstName",
                                    value
                                )
                            }
                        />

                        <Field
                            label="Last Name"
                            value={
                                form.lastName
                            }
                            placeholder="Enter last name"
                            required
                            onChange={(
                                value
                            ) =>
                                set(
                                    "lastName",
                                    value
                                )
                            }
                        />

                        <Field
                            label="Email"
                            type="email"
                            value={
                                form.email
                            }
                            placeholder="name@example.com"
                            required
                            onChange={(
                                value
                            ) =>
                                set(
                                    "email",
                                    value
                                )
                            }
                        />

                        <Field
                            label="Phone"
                            type="tel"
                            value={
                                form.phone
                            }
                            placeholder="Enter phone number"
                            onChange={(
                                value
                            ) =>
                                set(
                                    "phone",
                                    value
                                )
                            }
                        />

                    </div>

                </Card>


                {/* =================================================
                   STORE
                ================================================= */}

                <Card
                    icon="shop"
                    color="orange"
                    title="Store"
                    sub="Current store context for this user."
                >

                    <div className="form-grid two-columns">

                        <Field
                            label="Store Name"
                            value={
                                currentStore?.name ||
                                ""
                            }
                            readOnly
                        />

                        <Field
                            label="Store ID"
                            value={
                                currentStore?.id ||
                                ""
                            }
                            readOnly
                        />

                    </div>

                    <div className="store-edit-note">

                        <i className="bi bi-info-circle" />

                        <span>
                            Store assignment is
                            managed from
                            Dashboard →
                            Employees. The role
                            can be changed here
                            for this store.
                        </span>

                    </div>

                </Card>


                {/* =================================================
                   LOGIN PIN
                ================================================= */}

                <Card
                    icon="shield-lock"
                    color="green"
                    title="Login PIN"
                    sub="Update the user's 6-digit login PIN."
                >

                    <div className="form-grid two-columns">

                        <div className="field">

                            <label>
                                New Login PIN
                            </label>

                            <div className="input-with-action">

                                <input
                                    type="text"
                                    value={
                                        form.loginPin
                                    }
                                    placeholder="Enter 6-digit PIN"
                                    maxLength={
                                        6
                                    }
                                    inputMode="numeric"
                                    autoComplete="off"
                                    onChange={(
                                        event
                                    ) =>
                                        set(
                                            "loginPin",
                                            event
                                                .target
                                                .value
                                                .replace(
                                                    /\D/g,
                                                    ""
                                                )
                                        )
                                    }
                                />

                                

                            </div>

                            <small className="field-help">
                                Leave blank to keep
                                the existing PIN.
                            </small>

                        </div>

                    </div>

                </Card>


                {/* =================================================
                   PROFILE PHOTO
                ================================================= */}

                <Card
                    icon="image"
                    color="blue"
                    title="Profile Photo"
                    sub="Profile photo is mandatory."
                >

                    <div className="profile-upload">

                        <div className="profile-preview">

                            {form.profilePhoto ? (
                                <img
                                    src={
                                        form.profilePhoto
                                    }
                                    alt="User profile"
                                />
                            ) : (
                                <i className="bi bi-person" />
                            )}

                        </div>

                        <div className="upload-content">

                            <label
                                className="upload-button"
                                htmlFor="profilePhoto"
                            >
                                <i className="bi bi-upload" />

                                Change Photo
                            </label>

                            <input
                                ref={
                                    photo
                                }
                                id="profilePhoto"
                                type="file"
                                accept="image/png,image/jpeg,image/webp"
                                required={
                                    !form.profilePhoto
                                }
                                onChange={
                                    onPhotoChange
                                }
                            />

                            <span className="file-name">
                                JPG, PNG or WEBP ·
                                Maximum 2 MB
                            </span>

                            <small className="field-help">
                                Profile photo is
                                mandatory.
                            </small>

                        </div>

                    </div>

                </Card>


                {/* =================================================
                   ACTIONS
                ================================================= */}

                <div className="form-actions">

                    <button
                        type="button"
                        className="cancel-btn"
                        onClick={
                            onCancel
                        }
                    >
                        Cancel
                    </button>

                    <button
                        type="submit"
                        className="save-next-btn"
                    >
                        Save Changes

                        <i className="bi bi-check-lg" />
                    </button>

                </div>

            </form>

        </div>
    );
}


/* =========================================================
   FIELD
========================================================= */

function Field({
    label,
    value,
    placeholder = "",
    required = false,
    type = "text",
    readOnly = false,
    onChange,
}) {

    return (
        <div className="field">

            <label>

                {label}

                {required && (
                    <span>
                        *
                    </span>
                )}

            </label>

            <input
                type={type}
                value={
                    value || ""
                }
                placeholder={
                    placeholder
                }
                required={
                    required &&
                    !readOnly
                }
                readOnly={
                    readOnly
                }
                onChange={(
                    event
                ) =>
                    onChange?.(
                        event
                            .target
                            .value
                    )
                }
            />

        </div>
    );
}


/* =========================================================
   SELECT
========================================================= */

function Select({
    label,
    value,
    set,
    options,
}) {

    return (
        <div className="field">

            <label>

                {label}

                <span>
                    *
                </span>

            </label>

            <select
                value={
                    value
                }
                required
                onChange={(
                    event
                ) =>
                    set(
                        event
                            .target
                            .value
                    )
                }
            >

                <option value="">
                    Select{" "}
                    {label.toLowerCase()}
                </option>

                {options.map(
                    (
                        option
                    ) => (
                        <option
                            key={
                                option
                            }
                            value={
                                option
                            }
                        >
                            {
                                option
                            }
                        </option>
                    )
                )}

            </select>

        </div>
    );
}


/* =========================================================
   CARD
========================================================= */

function Card({
    icon,
    color,
    title,
    sub,
    children,
}) {

    return (
        <section className="form-card">

            <div className="form-card-header">

                <div
                    className={`section-icon ${color}`}
                >
                    <i
                        className={`bi bi-${icon}`}
                    />
                </div>

                <div>

                    <h2>
                        {title}
                    </h2>

                    <p>
                        {sub}
                    </p>

                </div>

            </div>

            <div className="form-card-body">
                {children}
            </div>

        </section>
    );
}
